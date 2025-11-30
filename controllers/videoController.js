import { Video } from '../models/Video.js';
import { pool } from '../config/db.js';
import path, { join, dirname } from 'path';
import fs from 'fs';
import { ThumbnailService } from '../services/thumbnailService.js';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const videoController = {
  // ==================== دوال المشاركة الجديدة ====================

  // ✅ تسجيل مشاركة الفيديو
  async addShare(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user?.id;
      const { shareMethod = 'direct' } = req.body;

      console.log(`📤 Recording share for video ${videoId} by user ${userId}, method: ${shareMethod}`);

      // التحقق مما إذا شارك المستخدم الفيديو مسبقاً
      const hasShared = await Video.hasUserShared(videoId, userId);

      if (!hasShared) {
        // تسجيل المشاركة
        const shareRecorded = await Video.addShare(videoId, userId);

        if (shareRecorded) {
          console.log(`✅ Share recorded for video ${videoId}`);

          // تسجيل التفاعل في نظام التوصية
          try {
            const { recommendationEngine } = await import('../services/recommendationEngine.js');
            await recommendationEngine.recordInteraction({
              userId,
              videoId: parseInt(videoId),
              type: 'share',
              weight: 1.5,
              metadata: { shareMethod },
              timestamp: new Date()
            });
          } catch (recError) {
            console.error('Failed to record share interaction:', recError);
            // تسجيل بديل في قاعدة البيانات
            await Video.recordUserInteraction(userId, videoId, 'share', 1.5);
          }
        }
      } else {
        console.log(`⚠️ User ${userId} already shared video ${videoId}`);
      }

      // الحصول على العدد المحدث للمشاركات
      const shareCount = await Video.getShareCount(videoId);

      res.json({
        success: true,
        message: 'Share recorded successfully',
        shareCount: shareCount,
        alreadyShared: hasShared
      });
    } catch (error) {
      console.error('❌ Add share error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record share'
      });
    }
  },

  // ✅ الحصول على عدد المشاركات
  async getShareCount(req, res) {
    try {
      const { videoId } = req.params;

      const shareCount = await Video.getShareCount(videoId);

      res.json({
        success: true,
        shareCount: shareCount
      });
    } catch (error) {
      console.error('❌ Get share count error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get share count'
      });
    }
  },

  // ==================== دوال جديدة ====================

  // ✅ الحصول على فيديوهات المستخدم مع إمكانية الفرز
  async getUserVideos(req, res) {
  try {
    const { userId } = req.params;
    const { sortBy = 'latest' } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const targetUserId = parseInt(userId);
    const reqUserId = parseInt(req.user?.id) || 0;

    let orderBy = 'v.created_at DESC';
    switch (sortBy) {
      case 'trending':
        orderBy = 'v.views DESC, v.likes DESC, v.shares DESC';
        break;
      case 'oldest':
        orderBy = 'v.created_at ASC';
        break;
      case 'latest':
      default:
        orderBy = 'v.created_at DESC';
    }

    const [videos] = await pool.execute(
      `SELECT v.*, u.username, u.avatar,
              COUNT(DISTINCT l.user_id) as likes,
              EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
       FROM videos v
       JOIN users u ON v.user_id = u.id
       LEFT JOIN likes l ON v.id = l.video_id
       WHERE v.user_id = ? AND v.deleted_by_admin = FALSE
       GROUP BY v.id
       ORDER BY ${orderBy}`,
      [reqUserId, targetUserId]
    );

    // ✅ إضافة التعليقات الافتراضية و thumbnail و video_url
    for (let video of videos) {
      const [commentCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
        [video.id]
      );
      video.comment_count = commentCount[0].count;

      // thumbnail افتراضي
      if (!video.thumbnail) {
        video.thumbnail = '/default-thumbnail.jpg';
      }

      // video_url افتراضي
      if (!video.video_url) {
        video.video_url = '/default-video.mp4';
      }
    }

    res.json({ success: true, videos: videos || [] });

  } catch (error) {
    console.error('❌ Get user videos error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user videos' });
  }
},

  // ✅ تسجيل مشاهدة الفيديو
  async addView(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user?.id;

      console.log(`👁️ Recording view for video ${videoId} by user ${userId}`);

      // التحقق من أن المستخدم لم يشاهد الفيديو من قبل
      const [existingViews] = await pool.execute(
        'SELECT id FROM video_views WHERE video_id = ? AND user_id = ?',
        [videoId, userId]
      );

      if (existingViews.length === 0) {
        // تسجيل المشاهدة
        await pool.execute(
          'INSERT INTO video_views (video_id, user_id) VALUES (?, ?)',
          [videoId, userId]
        );

        // تحديث عدد المشاهدات
        await pool.execute(
          'UPDATE videos SET views = views + 1 WHERE id = ?',
          [videoId]
        );

        console.log(`✅ View recorded for video ${videoId}`);
      } else {
        console.log(`⚠️ User ${userId} already viewed video ${videoId}`);
      }

      res.json({
        success: true,
        message: 'View recorded successfully'
      });
    } catch (error) {
      console.error('❌ Add view error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record view'
      });
    }
  },

  // ==================== دوال الرفع والحصول على الفيديوهات ====================
  async uploadVideo(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "Video file is required" });

    const { description, replaceVideoId } = req.body;
    const file = req.file;
    const extension = file.originalname.split(".").pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2)}.${extension}`;

    // -----------------------
    // رفع الفيديو إلى Supabase
    // -----------------------
    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(uniqueName, fs.createReadStream(file.path), { contentType: file.mimetype });

    if (uploadError) throw uploadError;

    const publicUrl = supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .getPublicUrl(uniqueName).data.publicUrl;

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    // -----------------------
    // توليد الـ Thumbnail
    // -----------------------
    let thumbnailPublicUrl = null;
    const thumbName = `thumb_${uniqueName}.jpg`;
    const tempDir = join(__dirname, '..', 'temp');
    const thumbLocal = join(tempDir, thumbName);

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    try {
      await ThumbnailService.generateThumbnail(file.path, tempDir, thumbName);

      const { error: thumbError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(`thumbnails/${thumbName}`, fs.createReadStream(thumbLocal), { contentType: "image/jpeg" });

      if (thumbError) throw thumbError;

      thumbnailPublicUrl = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(`thumbnails/${thumbName}`).data.publicUrl;

      if (fs.existsSync(thumbLocal)) fs.unlinkSync(thumbLocal);

    } catch (err) {
      console.error("❌ Thumbnail error:", err);
      thumbnailPublicUrl = "/default-thumbnail.jpg";
    }

    // -----------------------
    // حفظ الفيديو أو استبداله
    // -----------------------
    if (replaceVideoId) {
      await pool.execute(
        "UPDATE videos SET video_url = ?, thumbnail = ?, description = ? WHERE id = ? AND user_id = ?",
        [publicUrl, thumbnailPublicUrl, description || null, replaceVideoId, req.user.id]
      );
      const updatedVideo = await Video.findById(replaceVideoId);
      return res.status(200).json({ message: "Video replaced successfully", video: updatedVideo });
    }
const videoId = await Video.create({
  user_id: req.user.id,
  video_url: publicUrl,
  thumbnail: thumbnailPublicUrl,
  description: description || "",
  is_public: true,
  path: publicUrl, // ✅ أضفنا path هنا
  subspace_video_id: null,
  subspace_thumbnail_id: null
});

    const video = await Video.findById(videoId);
    return res.status(201).json({ message: "Video uploaded successfully", video });

  } catch (error) {
    console.error("❌ Upload error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
},


  async getRecommendedVideos(req, res) {
    try {
      const userId = req.user.id;
      // ✅ استخدام قيم افتراضية آمنة
      const limit = parseInt(req.query.limit) || 10;

      console.log(`🔄 Getting recommended videos for user: ${userId}`);

      // استخدام محرك التوصية إذا كان موجوداً
      try {
        const { recommendationEngine } = await import('../services/recommendationEngine.js');
        const recommendedVideos = await recommendationEngine.getRecommendedVideos(userId, limit);

        // ✅ إضافة عدد التعليقات لكل فيديو موصى به
        for (let video of recommendedVideos) {
          const [commentCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
            [video.id]
          );
          video.comment_count = commentCount[0].count;

          // ✅ التأكد من وجود thumbnail افتراضي
          if (!video.thumbnail) {
            video.thumbnail = '/default-thumbnail.jpg';
          }
        }

        res.json({
          videos: recommendedVideos,
          message: 'Recommended videos based on your interests'
        });
      } catch (recError) {
        console.error('Recommendation engine failed, using fallback:', recError);

        // Fallback: فيديوهات المتابَعين + فيديوهات شائعة
        const followingVideos = await Video.getVideosFromFollowingUsers(userId, Math.floor(limit * 0.6));
        const popularVideos = await Video.getMostViewedVideos(Math.floor(limit * 0.4));

        const allVideos = [...followingVideos, ...popularVideos];
        const uniqueVideos = this.removeDuplicates(allVideos);

        // ✅ إضافة عدد التعليقات لكل فيديو في الفال باك
        for (let video of uniqueVideos) {
          const [commentCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
            [video.id]
          );
          video.comment_count = commentCount[0].count;

          // ✅ التأكد من وجود thumbnail افتراضي
          if (!video.thumbnail) {
            video.thumbnail = '/default-thumbnail.jpg';
          }
        }

        res.json({
          videos: uniqueVideos.slice(0, limit),
          message: 'Popular videos and videos from followed users'
        });
      }
    } catch (error) {
      console.error('Get recommended videos error:', error);

      // Fallback نهائي إلى الفيديوهات العادية
      const videos = await Video.getVideos(10, 0);

      // ✅ إضافة عدد التعليقات لكل فيديو في الفال باك النهائي
      for (let video of videos) {
        const [commentCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
          [video.id]
        );
        video.comment_count = commentCount[0].count;

        // ✅ التأكد من وجود thumbnail افتراضي
        if (!video.thumbnail) {
          video.thumbnail = '/default-thumbnail.jpg';
        }
      }

      res.json({
        videos,
        message: 'Popular videos'
      });
    }
  },

  async getFollowingVideos(req, res) {
    try {
      const userId = req.user.id;
      // ✅ استخدام قيم افتراضية آمنة
      const limit = parseInt(req.query.limit) || 10;

      console.log(`🔄 Getting following videos for user: ${userId}`);

      const videos = await Video.getVideosFromFollowingUsers(userId, limit);

      // ✅ إضافة عدد التعليقات لكل فيديو للمتابَعين
      for (let video of videos) {
        const [commentCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
          [video.id]
        );
        video.comment_count = commentCount[0].count;

        // ✅ التأكد من وجود thumbnail افتراضي
        if (!video.thumbnail) {
          video.thumbnail = '/default-thumbnail.jpg';
        }
      }

      res.json({
        videos,
        message: 'Videos from users you follow'
      });
    } catch (error) {
      console.error('Get following videos error:', error);

      // Fallback إلى الفيديوهات العادية
      const videos = await Video.getVideos(limit, 0);

      // ✅ إضافة عدد التعليقات لكل فيديو في الفال باك
      for (let video of videos) {
        const [commentCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
          [video.id]
        );
        video.comment_count = commentCount[0].count;

        // ✅ التأكد من وجود thumbnail افتراضي
        if (!video.thumbnail) {
          video.thumbnail = '/default-thumbnail.jpg';
        }
      }

      res.json({
        videos,
        message: 'Popular videos'
      });
    }
  },

  async getVideo(req, res) {
    try {
      const { id } = req.params;
      // ✅ استخدام قيم افتراضية آمنة
      const userId = req.user?.id || 0;

      console.log('🔍 Fetching video:', id);

      const video = await Video.getVideoWithLikes(id, userId);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // ✅ التأكد من وجود thumbnail افتراضي
      if (!video.thumbnail) {
        video.thumbnail = '/default-thumbnail.jpg';
      }

      // ✅ التحقق من وجود الملف الفعلي على السيرفر
      const videoFilename = path.basename(video.path);
      const videoFilePath = path.join(process.cwd(), 'uploads', 'videos', videoFilename);

      if (!fs.existsSync(videoFilePath)) {
        console.log('❌ Video file missing on server:', videoFilePath);
        return res.status(404).json({
          error: 'Video file not found on server',
          details: 'The video record exists but the file is missing'
        });
      }

      // ✅ إضافة عدد التعليقات للفيديو
      const [commentCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
        [id]
      );
      video.comment_count = commentCount[0].count;

      await Video.incrementViews(id);

      res.json({
        video: {
          ...video,
          file_exists: true,
          file_path: videoFilePath
        }
      });
    } catch (error) {
      console.error('Get video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getUserVideo(req, res) {
    try {
      // ✅ التعديل: الحصول على آخر فيديو للمستخدم بدلاً من فيديو واحد فقط
      const videos = await Video.getVideosByUser(req.user.id, 1, 0);
      const video = videos.length > 0 ? videos[0] : null;

      if (video) {
        // ✅ إضافة عدد التعليقات لفيديو المستخدم
        const [commentCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
          [video.id]
        );
        video.comment_count = commentCount[0].count;

        // ✅ التأكد من وجود thumbnail افتراضي
        if (!video.thumbnail) {
          video.thumbnail = '/default-thumbnail.jpg';
        }
      }

      res.json({ video });
    } catch (error) {
      console.error('Get user video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ==================== دوال التفاعل مع الفيديوهات ====================

  async deleteVideo(req, res) {
    try {
      const { id } = req.params;

      console.log('🗑️ Deleting video:', id);

      // الحصول على معلومات الفيديو قبل الحذف
      const video = await Video.findById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // ✅ التحقق من أن المستخدم هو صاحب الفيديو
      if (video.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // ✅ التعديل: المسار الصحيح لحذف الملف
      const filePath = path.join(process.cwd(), 'uploads', 'videos', path.basename(video.path));
      console.log('📍 File to delete:', filePath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('✅ Video file deleted from server');
      } else {
        console.log('⚠️ Video file not found on server:', filePath);
      }

      // ✅ حذف thumbnail
      if (video.thumbnail && !video.thumbnail.includes('default-thumbnail')) {
        ThumbnailService.deleteThumbnail(video.thumbnail);
      }

      const deleted = await Video.delete(id, req.user.id);

      if (!deleted) {
        return res.status(404).json({ error: 'Video not found or access denied' });
      }

      res.json({ message: 'Video deleted successfully' });
    } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async likeVideo(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.id;

      console.log(`Like/Unlike request - User: ${userId}, Video: ${videoId}`);

      const result = await Video.likeVideo(userId, parseInt(videoId));

      if (!result.success) {
        return res.status(500).json({
          error: 'Like action failed',
          details: result.error
        });
      }

      const likeCount = await Video.getLikeCount(parseInt(videoId));
      const isLiked = result.liked;

      // تسجيل التفاعل في نظام التوصية
      try {
        const { recommendationEngine } = await import('../services/recommendationEngine.js');
        await recommendationEngine.recordInteraction({
          userId,
          videoId: parseInt(videoId),
          type: result.liked ? 'like' : 'unlike',
          weight: result.liked ? 1.0 : -1.0,
          timestamp: new Date()
        });
      } catch (recError) {
        console.error('Failed to record interaction:', recError);
        // تسجيل بديل في قاعدة البيانات
        await Video.recordUserInteraction(userId, videoId, result.liked ? 'like' : 'unlike', result.liked ? 1.0 : -1.0);
      }

      res.json({
        message: `Video ${result.action} successfully`,
        likes: likeCount,
        isLiked: isLiked,
        action: result.action
      });

    } catch (error) {
      console.error('Like video error in controller:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async unlikeVideo(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.id;

      console.log(`Unlike request - User: ${userId}, Video: ${videoId}`);

      const result = await Video.unlikeVideo(userId, parseInt(videoId));

      if (!result.success) {
        return res.status(404).json({ error: 'Video not liked' });
      }

      const likeCount = await Video.getLikeCount(parseInt(videoId));

      res.json({
        message: 'Video unliked successfully',
        likes: likeCount,
        isLiked: false,
        action: 'unliked'
      });
    } catch (error) {
      console.error('Unlike video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getLikedVideos(req, res) {
  try {
    const userId = req.user.id;

    const videos = await Video.getUserLikedVideos(userId);

    // ✅ إضافة عدد التعليقات لكل فيديو محبب والتحقق من thumbnail و video_url
    for (let video of videos) {
      // عدد التعليقات
      const [commentCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
        [video.id]
      );
      video.comment_count = commentCount[0].count;

      // ✅ التأكد من وجود thumbnail افتراضي
      if (!video.thumbnail) {
        video.thumbnail = '/default-thumbnail.jpg';
      }

      // ✅ التأكد من وجود video_url افتراضي
      if (!video.video_url) {
        video.video_url = '/default-video.mp4';
      }
    }

    res.json({ videos });
  } catch (error) {
    console.error('Get liked videos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
},


  // ==================== دوال سجل المشاهدة والتفاعل ====================

  async recordWatchHistory(req, res) {
    try {
      const userId = req.user.id;
      const { videoId, watchTime, completed } = req.body;

      console.log(`📊 Recording watch history - User: ${userId}, Video: ${videoId}, Time: ${watchTime}s`);

      // تسجيل في سجل المشاهدة
      await pool.execute(
        `INSERT INTO watch_history (user_id, video_id, watch_time, completed, created_at) 
         VALUES (?, ?, ?, ?, NOW()) 
         ON DUPLICATE KEY UPDATE 
         watch_time = watch_time + VALUES(watch_time),
         completed = VALUES(completed),
         updated_at = NOW()`,
        [userId, videoId, watchTime || 0, completed || false]
      );

      // تحديث إحصائيات المستخدم
      await pool.execute(
        'UPDATE users SET total_watch_time = total_watch_time + ? WHERE id = ?',
        [watchTime || 0, userId]
      );

      // تسجيل في نظام التوصية
      try {
        const { recommendationEngine } = await import('../services/recommendationEngine.js');
        await recommendationEngine.recordInteraction({
          userId,
          videoId,
          type: 'watch',
          weight: completed ? 2.0 : Math.min((watchTime || 0) / 60, 1.5),
          metadata: { watchTime, completed }
        });
      } catch (recError) {
        console.error('Failed to record watch interaction:', recError);
        // تسجيل بديل في قاعدة البيانات
        await Video.recordUserInteraction(userId, videoId, 'watch', completed ? 2.0 : Math.min((watchTime || 0) / 60, 1.5));
      }

      res.json({ message: 'Watch history recorded successfully' });
    } catch (error) {
      console.error('Record watch history error:', error);
      res.status(500).json({ error: 'Failed to record watch history' });
    }
  },

  async recordInteraction(req, res) {
    try {
      const userId = req.user.id;
      const { videoId, type, weight, metadata } = req.body;

      console.log(`🎯 Recording interaction - User: ${userId}, Video: ${videoId}, Type: ${type}`);

      // استخدام محرك التوصية إذا كان موجوداً
      try {
        const { recommendationEngine } = await import('../services/recommendationEngine.js');
        await recommendationEngine.recordInteraction({
          userId,
          videoId,
          type,
          weight: weight || 1.0,
          metadata,
          timestamp: new Date()
        });
      } catch (recError) {
        console.error('Failed to record interaction in engine:', recError);
        // تسجيل بديل في قاعدة البيانات
        await Video.recordUserInteraction(userId, videoId, type, weight || 1.0);
      }

      res.json({ message: 'Interaction recorded successfully' });
    } catch (error) {
      console.error('Record interaction error:', error);
      res.status(500).json({ error: 'Failed to record interaction' });
    }
  },

  // ==================== دوال البحث والإحصائيات ====================

    // ==================== 📋 GET /api/videos (عام) ====================
  async getVideos(req, res) {
    try {
      // ✅ قيم افتراضية آمنة
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      // ✅ نوع الفرز (views, likes, latest, oldest)
      const sortBy = ['views','likes','latest','oldest'].includes(req.query.sortBy)
                       ? req.query.sortBy
                       : 'latest';

      let orderSQL = 'v.created_at DESC';
      switch (sortBy) {
        case 'views':  orderSQL = 'v.views DESC';      break;
        case 'likes':  orderSQL = 'likes DESC';       break;
        case 'oldest': orderSQL = 'v.created_at ASC'; break;
      }

      const userId = req.user?.id || 0; // optionalAuth يمكن أن يملأه

      // ✅ الاستعلام الأساسي
      const [rows] = await pool.execute(
        `SELECT 
           v.id,
           v.user_id,
           v.description,
           v.video_url,
           v.thumbnail,
           v.views,
           v.created_at,
           u.username,
           u.avatar,
           COUNT(DISTINCT l.user_id)                 AS likes,
           COUNT(DISTINCT c.id)                      AS comment_count,
           EXISTS(SELECT 1 FROM likes
                  WHERE user_id = ? AND video_id = v.id) AS is_liked
         FROM videos      AS v
         JOIN users       AS u ON u.id = v.user_id
         LEFT JOIN likes  AS l ON l.video_id = v.id
         LEFT JOIN comments AS c ON c.video_id = v.id AND c.deleted_by_admin = FALSE
         WHERE v.is_public = TRUE
           AND v.deleted_by_admin = FALSE
         GROUP BY v.id
         ORDER BY ${orderSQL}
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

    rows.forEach(v => { if (!v.thumbnail) v.thumbnail = '/default-thumbnail.jpg'; 
      if (!v.video_url) v.video_url = '/default-video.mp4'; });

      // ✅ العدد الإجمالي (لتفعيل الترقيم لاحقاً)
      const [totalRes] = await pool.execute(
        'SELECT COUNT(*) AS total FROM videos WHERE is_public = TRUE AND deleted_by_admin = FALSE'
      );
      const total = totalRes[0].total;

      res.json({
        success: true,
        videos: rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('❌ getVideos error:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch videos' });
    }
  },

  async searchVideos(req, res) {
    try {
      const { q } = req.query;
      // ✅ استخدام قيم افتراضية آمنة
      const userId = req.user?.id || 0;
      const limit = parseInt(req.query.limit) || 20;

      if (!q || q.trim().length < 2) {
        return res.json({ videos: [] });
      }

      const videos = await Video.searchVideos(q.trim(), userId, limit);

      // ✅ إضافة عدد التعليقات لكل فيديو في نتائج البحث
      for (let video of videos) {
        const [commentCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
          [video.id]
        );
        video.comment_count = commentCount[0].count;

        // ✅ التأكد من وجود thumbnail افتراضي
        if (!video.thumbnail) {
          video.thumbnail = '/default-thumbnail.jpg';
        }
      }

      res.json({ videos });
    } catch (error) {
      console.error('Search videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getTrendingVideos(req, res) {
    try {
      // ✅ استخدام قيم افتراضية آمنة
      const limit = parseInt(req.query.limit) || 10;
      const days = parseInt(req.query.days) || 7;

      const videos = await Video.getTrendingVideos(limit, days);

      // ✅ إضافة عدد التعليقات لكل فيديو في الترند
      for (let video of videos) {
        const [commentCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
          [video.id]
        );
        video.comment_count = commentCount[0].count;

        // ✅ التأكد من وجود thumbnail افتراضي
        if (!video.thumbnail) {
          video.thumbnail = '/default-thumbnail.jpg';
        }
      }

      res.json({ videos });
    } catch (error) {
      console.error('Get trending videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getVideoStats(req, res) {
    try {
      const { videoId } = req.params;
      const stats = await Video.getVideoStats(videoId);

      res.json({ stats });
    } catch (error) {
      console.error('Get video stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getCommentCount(req, res) {
    try {
      const { videoId } = req.params;

      const [commentCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
        [videoId]
      );

      res.json({ count: commentCount[0].count });
    } catch (error) {
      console.error('Get comment count error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ==================== 🚀 VIDEO TURBO ENGINE ENDPOINTS ====================

  /**
   * الحصول على manifest file للفيديو (HLS)
   */
  async getManifest(req, res) {
    try {
      const { videoId } = req.params;
      const { videoChunkService } = await import('../services/videoChunkService.js');

      const status = await videoChunkService.getProcessingStatus(videoId);

      if (!status) {
        return res.status(404).json({ error: 'Video manifest not found' });
      }

      if (status.processing_status !== 'completed') {
        return res.status(202).json({
          message: 'Video is still processing',
          status: status.processing_status
        });
      }

      // إرجاع مسار الـ manifest
      res.json({
        manifestPath: status.manifest_path,
        totalChunks: status.total_chunks,
        status: status.processing_status
      });

    } catch (error) {
      console.error('Get manifest error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * الحصول على chunk محدد
   */
  async getChunk(req, res) {
    try {
      const { videoId, quality, index } = req.params;

      const chunkPath = path.join(
        process.cwd(),
        'uploads',
        'chunks',
        videoId,
        quality,
        `segment_${String(index).padStart(3, '0')}.ts`
      );

      if (!fs.existsSync(chunkPath)) {
        return res.status(404).json({ error: 'Chunk not found' });
      }

      // إرسال الـ chunk
      res.sendFile(chunkPath);

    } catch (error) {
      console.error('Get chunk error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * الحصول على حالة معالجة الفيديو
   */
  async getProcessingStatus(req, res) {
    try {
      const { videoId } = req.params;
      const { videoChunkService } = await import('../services/videoChunkService.js');

      const status = await videoChunkService.getProcessingStatus(videoId);

      if (!status) {
        return res.status(404).json({ error: 'Processing status not found' });
      }

      res.json({
        videoId: parseInt(videoId),
        status: status.processing_status,
        totalChunks: status.total_chunks,
        manifestPath: status.manifest_path,
        errorMessage: status.error_message,
        createdAt: status.created_at,
        updatedAt: status.updated_at
      });

    } catch (error) {
      console.error('Get processing status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * الحصول على تقدم المشاهدة للفيديو
   */
  async getVideoProgress(req, res) {
  try {
    const { videoId } = req.params;
    const userId = req.user.id;

    const { videoProgressService } = await import('../services/videoProgressService.js');
    const progress = await videoProgressService.getProgress(userId, parseInt(videoId));

    // إذا لم يوجد أي تقدم، نرجع الافتراضيات مع رابط فيديو افتراضي
    if (!progress) {
      return res.json({
        lastPosition: 0,
        watchTime: 0,
        completed: false,
        video_url: "/default-video.mp4" // رابط افتراضي
      });
    }

    // إذا الفيديو موجود ولكن بدون رابط
    if (!progress.video_url) {
      progress.video_url = "/default-video.mp4";
    }

    res.json(progress);

  } catch (error) {
    console.error('Get video progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
},


  /**
   * حفظ تقدم المشاهدة
   */
  async saveVideoProgress(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.id;
      const { lastPosition, watchTime, completed } = req.body;

      const { videoProgressService } = await import('../services/videoProgressService.js');
      const success = await videoProgressService.saveProgress(
        userId,
        parseInt(videoId),
        parseFloat(lastPosition) || 0,
        parseInt(watchTime) || 0,
        completed || false
      );

      if (success) {
        res.json({ message: 'Progress saved successfully' });
      } else {
        res.status(500).json({ error: 'Failed to save progress' });
      }

    } catch (error) {
      console.error('Save video progress error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * الحصول على الفيديوهات غير المكتملة (للاستئناف)
   */
  async getIncompleteVideos(req, res) {
    try {
      const userId = req.user.id;
      // ✅ استخدام قيم افتراضية آمنة
      const limit = parseInt(req.query.limit) || 10;

      const { videoProgressService } = await import('../services/videoProgressService.js');
      const videos = await videoProgressService.getIncompleteVideos(userId, limit);

      res.json({ videos });

    } catch (error) {
      console.error('Get incomplete videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ==================== دوال مساعدة ====================

  // دالة مساعدة لإزالة التكرارات
  removeDuplicates(videos) {
    const seen = new Set();
    return videos.filter(video => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    });
  }
};
