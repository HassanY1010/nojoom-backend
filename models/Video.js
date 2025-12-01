import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';

export class Video {
  // ============ الأساسية ============
static async create(videoData) {
  const {
    user_id,
    video_url,
    thumbnail,
    description,
    is_public = true,
    path,
    subspace_video_id = null,
    subspace_thumbnail_id = null,
    title = 'بدون عنوان' // ✅ أضف هذا
  } = videoData;

  const finalPath = path || video_url;
  if (!finalPath) throw new Error('path or video_url is required');

  const [result] = await pool.execute(
    `INSERT INTO videos
       (user_id, video_url, thumbnail, description, is_public, path,
        subspace_video_id, subspace_thumbnail_id, url, title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      video_url,
      thumbnail || '/default-thumbnail.jpg',
      description || null,
      is_public,
      finalPath,
      subspace_video_id,
      subspace_thumbnail_id,
      video_url || '',
      title || 'بدون عنوان' // ✅ تأكد من وجود عنوان
    ]
  );
  return result.insertId;
}
  // ✅ تسجيل مشاركة الفيديو
  static async addShare(videoId, userId) {
    try {
      // تسجيل المشاركة في سجل المشاركات
      await pool.execute(
        'INSERT INTO video_shares (video_id, user_id, share_method) VALUES (?, ?, ?)',
        [videoId, userId, 'direct']
      );

      // تحديث عدد المشاركات في الفيديو
      await pool.execute(
        'UPDATE videos SET shares = COALESCE(shares, 0) + 1 WHERE id = ?',
        [videoId]
      );

      return true;
    } catch (error) {
      console.error('Error in Video.addShare:', error);
      return false;
    }
  }

  // ✅ الحصول على عدد المشاركات
  static async getShareCount(videoId) {
    try {
      const [rows] = await pool.execute(
        'SELECT COALESCE(shares, 0) as shares FROM videos WHERE id = ?',
        [videoId]
      );
      return rows[0]?.shares || 0;
    } catch (error) {
      console.error('Error in Video.getShareCount:', error);
      return 0;
    }
  }

  // ✅ التحقق مما إذا شارك المستخدم الفيديو
  static async hasUserShared(videoId, userId) {
    try {
      const [rows] = await pool.execute(
        'SELECT id FROM video_shares WHERE video_id = ? AND user_id = ?',
        [videoId, userId]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Error in Video.hasUserShared:', error);
      return false;
    }
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT v.*, u.username, u.avatar 
       FROM videos v 
       JOIN users u ON v.user_id = u.id 
       WHERE v.id = ? AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE`,
      [id]
    );
    return rows[0];
  }

  static async getVideos(limit = 10, offset = 0, userId = 0) {
  try {
    // ✅ استخدام قيم افتراضية آمنة
    const safeUserId = parseInt(userId) || 0;
    const safeLimit = parseInt(limit) || 10;
    const safeOffset = parseInt(offset) || 0;

    console.log('🔍 Executing getVideos query with params:', {
      userId: safeUserId,
      limit: safeLimit,
      offset: safeOffset
    });

    // MySQL لا يقبل placeholders مباشرة للـ LIMIT/OFFSET في بعض الحالات
    const query = `
      SELECT v.*, u.username, u.avatar,
             COUNT(DISTINCT l.user_id) as likes,
             EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
      FROM videos v
      JOIN users u ON v.user_id = u.id
      LEFT JOIN likes l ON v.id = l.video_id
      WHERE v.deleted_by_admin = FALSE AND u.is_banned = FALSE
      GROUP BY v.id
      ORDER BY v.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;

    const [rows] = await pool.execute(query, [safeUserId, safeLimit, safeOffset]);

    console.log(`✅ Found ${rows.length} videos`);
    return rows;
  } catch (error) {
    console.error('❌ Error in Video.getVideos:', error);
    return [];
  }
}

  // ============ نظام التوصية المتقدم ============
 static async getVideosFromFollowingUsers(userId, limit = 10) {
  try {
    const safeUserId = parseInt(userId) || 0;
    const safeLimit = parseInt(limit) || 10;

    const [rows] = await pool.execute(
      `SELECT v.*, u.username, u.avatar,
              COUNT(DISTINCT l.user_id) as likes,
              EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
       FROM videos v
       JOIN users u ON v.user_id = u.id
       JOIN followers f ON v.user_id = f.following_id
       LEFT JOIN likes l ON v.id = l.video_id
       WHERE f.follower_id = ? 
         AND v.deleted_by_admin = FALSE 
         AND u.is_banned = FALSE
       GROUP BY v.id
       ORDER BY v.created_at DESC
       LIMIT ?`,
      [safeUserId, safeUserId, safeLimit]
    );
    return rows;
  } catch (error) {
    console.error('Error in Video.getVideosFromFollowingUsers:', error);
    return [];
  }
}
static async getVideosByPreferences(userId, preferences, limit = 10) {
  try {
    let { preferred_categories = [], excluded_users = [] } = preferences;

    // 🔥 تنظيف المصفوفات لمنع الأخطاء
    const cleanExcludedUsers = (Array.isArray(excluded_users) ? excluded_users : [])
      .filter(id => id !== null && id !== undefined && !isNaN(id))
      .map(id => parseInt(id));

    const cleanPreferredCategories = (Array.isArray(preferred_categories) ? preferred_categories : [])
      .filter(cat => typeof cat === 'string' && cat.trim() !== '');

    // قيم آمنة
    const safeUserId = parseInt(userId) || 0;
    const safeLimit = parseInt(limit) || 10;

    let query = `
      SELECT v.*, u.username, u.avatar,
             COUNT(DISTINCT l.user_id) as likes,
             EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked,
             (SELECT COUNT(*) FROM watch_history WHERE user_id = ? AND video_id = v.id) as watch_count
      FROM videos v
      JOIN users u ON v.user_id = u.id
      LEFT JOIN likes l ON v.id = l.video_id
      WHERE v.deleted_by_admin = FALSE 
        AND u.is_banned = FALSE
    `;

    const params = [safeUserId, safeUserId];

    // 🔥 معالجة excluded_users الآمنة
    if (cleanExcludedUsers.length > 0) {
      query += ` AND v.user_id NOT IN (${cleanExcludedUsers.map(() => '?').join(',')})`;
      params.push(...cleanExcludedUsers);
    }

    // 🔥 معالجة preferred_categories الآمنة
    if (cleanPreferredCategories.length > 0) {
      query += ' AND (';
      cleanPreferredCategories.forEach((cat, index) => {
        if (index > 0) query += ' OR ';
        query += 'v.description LIKE ?';
        params.push(`%${cat}%`);
      });
      query += ')';
    }

    query += `
      GROUP BY v.id
      ORDER BY 
        (SELECT COALESCE(SUM(weight), 0) FROM user_interactions WHERE user_id = ? AND video_id = v.id) DESC,
        v.views DESC,
        v.created_at DESC
      LIMIT ?
    `;

    params.push(safeUserId, safeLimit);

    console.log('Executing getVideosByPreferences with params:', params);

    const [rows] = await pool.execute(query, params);
    return rows;

  } catch (error) {
    console.error('Error in Video.getVideosByPreferences:', error);
    return [];
  }
}


  static async getSimilarVideos(videoId, userId = null, limit = 10) {
    try {
      const currentVideo = await this.findById(videoId);
      if (!currentVideo) return [];

      const firstWord = currentVideo.description?.split(' ')[0] || '';
      
      // ✅ استخدام قيم افتراضية آمنة
      const safeUserId = userId || 0;
      const safeLimit = parseInt(limit) || 10;

      const [rows] = await pool.execute(
        `SELECT v.*, u.username, u.avatar,
                COUNT(DISTINCT l.user_id) as likes,
                EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked,
                (CASE 
                  WHEN v.description LIKE CONCAT('%', ?, '%') THEN 1 
                  ELSE 0 
                 END) as similarity_score
         FROM videos v
         JOIN users u ON v.user_id = u.id
         LEFT JOIN likes l ON v.id = l.video_id
         WHERE v.id != ? 
           AND v.deleted_by_admin = FALSE 
           AND u.is_banned = FALSE
           AND (v.description LIKE CONCAT('%', ?, '%') OR u.id = ?)
         GROUP BY v.id
         ORDER BY similarity_score DESC, v.views DESC
         LIMIT ?`,
        [
          safeUserId, 
          firstWord,
          videoId, 
          firstWord,
          currentVideo.user_id, 
          safeLimit
        ]
      );
      
      return rows;
    } catch (error) {
      console.error('Error in Video.getSimilarVideos:', error);
      return [];
    }
  }

  static async getRecommendedVideos(userId, limit = 20) {
    try {
      const userPreferences = await this.getUserVideoPreferences(userId);
      
      const followingVideos = await this.getVideosFromFollowingUsers(userId, Math.floor(limit * 0.4));
      
      const preferenceVideos = await this.getVideosByPreferences(
        userId, 
        userPreferences, 
        Math.floor(limit * 0.4)
      );
      
      const popularVideos = await this.getMostViewedVideos(Math.floor(limit * 0.2));
      
      const allVideos = [...followingVideos, ...preferenceVideos, ...popularVideos];
      const uniqueVideos = this.removeDuplicateVideos(allVideos);
      
      return uniqueVideos.slice(0, limit);
    } catch (error) {
      console.error('Error in Video.getRecommendedVideos:', error);
      return await this.getMostViewedVideos(limit);
    }
  }

  static async getUserVideoPreferences(userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT preferred_categories, excluded_users 
         FROM user_preferences 
         WHERE user_id = ?`,
        [userId]
      );
      
      if (rows[0]) {
        return {
          preferred_categories: JSON.parse(rows[0].preferred_categories || '[]'),
          excluded_users: JSON.parse(rows[0].excluded_users || '[]')
        };
      }
      
      return {
        preferred_categories: [],
        excluded_users: []
      };
    } catch (error) {
      console.error('Error in Video.getUserVideoPreferences:', error);
      return {
        preferred_categories: [],
        excluded_users: []
      };
    }
  }

  // ============ الإدارة ============
  static async getAllVideos(page = 1, limit = 10, search = '') {
    try {
      const offset = (page - 1) * limit;
      let query = `
        SELECT v.*, u.username, u.email, u.avatar,
               (SELECT COUNT(*) FROM likes WHERE video_id = v.id) as likes_count,
               (SELECT COUNT(*) FROM reports WHERE video_id = v.id AND status = 'pending') as pending_reports_count
        FROM videos v
        JOIN users u ON v.user_id = u.id
        WHERE v.deleted_by_admin = FALSE
      `;
      let countQuery = `SELECT COUNT(*) as total FROM videos v WHERE v.deleted_by_admin = FALSE`;
      const params = [];
      const countParams = [];

      if (search) {
        query += ' AND (v.description LIKE ? OR u.username LIKE ?)';
        countQuery += ' AND (v.description LIKE ? OR u.username LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
        countParams.push(searchTerm, searchTerm);
      }

      query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [videos] = await pool.execute(query, params);
      const [totalResult] = await pool.execute(countQuery, countParams);

      return {
        videos,
        total: totalResult[0].total,
        page,
        totalPages: Math.ceil(totalResult[0].total / limit)
      };
    } catch (error) {
      console.error('Error in Video.getAllVideos:', error);
      throw error;
    }
  }

  static async deleteVideoAdmin(videoId, reason = '') {
  try {
    // جلب بيانات الفيديو
    const [videos] = await pool.execute('SELECT * FROM videos WHERE id = ?', [videoId]);
    if (videos.length === 0) {
      throw new Error('Video not found');
    }

    const video = videos[0];

    // حذف ملفات Subspace أولاً
    if (video.subspace_video_id) {
      await subspaceClient.deleteFile(video.subspace_video_id);
    }
    if (video.subspace_thumbnail_id) {
      await subspaceClient.deleteFile(video.subspace_thumbnail_id);
    }

    // حذف الملفات المحلية القديمة
    if (video.path) {
      const filePath = path.join(process.cwd(), 'uploads', path.basename(video.path));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (video.thumbnail && !video.thumbnail.includes('default-thumbnail')) {
      const thumbPath = path.join(process.cwd(), 'thumbnails', path.basename(video.thumbnail));
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    // تحديث حالة الحذف في جدول الفيديو
    const [result] = await pool.execute(
      'UPDATE videos SET deleted_by_admin = TRUE, deletion_reason = ?, deleted_at = NOW() WHERE id = ?',
      [reason || 'Admin deletion', videoId]
    );

    // حذف أي تقارير مرتبطة
    await pool.execute('DELETE FROM reports WHERE video_id = ?', [videoId]);

    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in Video.deleteVideoAdmin:', error);
    throw error;
  }
}


  // ============ المستخدم ============
  static async getUserVideo(userId) {
    const [rows] = await pool.execute(
      `SELECT v.*, u.username, u.avatar 
       FROM videos v 
       JOIN users u ON v.user_id = u.id 
       WHERE v.user_id = ? AND v.deleted_by_admin = FALSE
       ORDER BY v.created_at DESC
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  static async getVideosByUser(userId, limit = 10, offset = 0) {
    // ✅ استخدام قيم افتراضية آمنة
    const safeLimit = parseInt(limit) || 10;
    const safeOffset = parseInt(offset) || 0;

    const [rows] = await pool.execute(
      `SELECT v.*, u.username, u.avatar 
       FROM videos v 
       JOIN users u ON v.user_id = u.id 
       WHERE v.user_id = ? AND v.deleted_by_admin = FALSE 
       ORDER BY v.created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, safeLimit, safeOffset]
    );
    return rows;
  }

  // ============ المشاهدات والإعجابات ============
  static async incrementViews(videoId) {
    await pool.execute(
      'UPDATE videos SET views = COALESCE(views, 0) + 1 WHERE id = ? AND deleted_by_admin = FALSE',
      [videoId]
    );
  }

  static async likeVideo(userId, videoId) {
    try {
      const [existingLikes] = await pool.execute(
        'SELECT user_id FROM likes WHERE user_id = ? AND video_id = ?',
        [userId, videoId]
      );

      if (existingLikes.length > 0) {
        await pool.execute(
          'DELETE FROM likes WHERE user_id = ? AND video_id = ?',
          [userId, videoId]
        );
        return { success: true, liked: false, action: 'unliked' };
      }

      await pool.execute(
        'INSERT INTO likes (user_id, video_id) VALUES (?, ?)',
        [userId, videoId]
      );
      
      return { success: true, liked: true, action: 'liked' };
      
    } catch (error) {
      console.error('Like video error in model:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: true, liked: true, action: 'liked' };
      }
      
      return { success: false, error: error.message };
    }
  }

  static async unlikeVideo(userId, videoId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM likes WHERE user_id = ? AND video_id = ?',
        [userId, videoId]
      );
      
      return { 
        success: result.affectedRows > 0,
        liked: false,
        action: 'unliked'
      };
    } catch (error) {
      console.error('Unlike video error in model:', error);
      return { success: false, error: error.message };
    }
  }

  static async isLiked(userId, videoId) {
    const [rows] = await pool.execute(
      'SELECT user_id FROM likes WHERE user_id = ? AND video_id = ?',
      [userId, videoId]
    );
    return rows.length > 0;
  }

  static async getVideoWithLikes(id, userId = null) {
    // ✅ استخدام قيم افتراضية آمنة
    const safeUserId = userId || 0;

    const [rows] = await pool.execute(
      `SELECT v.*, u.username, u.avatar, 
              COUNT(DISTINCT l.user_id) as likes,
              EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
       FROM videos v 
       JOIN users u ON v.user_id = u.id 
       LEFT JOIN likes l ON v.id = l.video_id
       WHERE v.id = ? AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE
       GROUP BY v.id`,
      [safeUserId, id]
    );
    return rows[0];
  }

  static async getLikeCount(videoId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM likes WHERE video_id = ?',
      [videoId]
    );
    return rows[0].count;
  }

  static async getUserLikedVideos(userId) {
    const [rows] = await pool.execute(
      `SELECT v.*, u.username, u.avatar,
              COUNT(DISTINCT l2.user_id) as likes,
              TRUE as is_liked
       FROM videos v 
       JOIN users u ON v.user_id = u.id 
       JOIN likes l ON v.id = l.video_id 
       LEFT JOIN likes l2 ON v.id = l2.video_id
       WHERE l.user_id = ? AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE
       GROUP BY v.id
       ORDER BY l.created_at DESC`,
      [userId]
    );
    return rows;
  }

  // ============ التثبيت ============
  static async pinVideo(videoId) {
    try {
      const [result] = await pool.execute(
        'UPDATE videos SET is_pinned = TRUE, pinned_at = NOW() WHERE id = ?',
        [videoId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Video.pinVideo:', error);
      throw error;
    }
  }

  static async unpinVideo(videoId) {
    try {
      const [result] = await pool.execute(
        'UPDATE videos SET is_pinned = FALSE, pinned_at = NULL WHERE id = ?',
        [videoId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Video.unpinVideo:', error);
      throw error;
    }
  }

  static async getPinnedVideos() {
    const [rows] = await pool.execute(
      `SELECT v.*, u.username, u.avatar 
       FROM videos v 
       JOIN users u ON v.user_id = u.id 
       WHERE v.is_pinned = TRUE AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE
       ORDER BY v.pinned_at DESC`
    );
    return rows;
  }

  // ============ الفيديوهات الشائعة ============
static async getMostViewedVideos(limit = 10) {
  const safeLimit = parseInt(limit) || 10;

  const [rows] = await pool.execute(
    `SELECT v.*, u.username, u.avatar 
     FROM videos v 
     JOIN users u ON v.user_id = u.id 
     WHERE v.deleted_by_admin = FALSE AND u.is_banned = FALSE
     ORDER BY COALESCE(v.views, 0) DESC 
     LIMIT ?`,
    [safeLimit]
  );
  return rows;
}
  static async getTrendingVideos(limit = 10, days = 7) {
    // ✅ استخدام قيم افتراضية آمنة
    const safeLimit = parseInt(limit) || 10;
    const safeDays = parseInt(days) || 7;

    const [rows] = await pool.execute(
      `SELECT v.*, u.username, u.avatar,
              COUNT(DISTINCT l.user_id) as likes,
              COALESCE(v.views, 0) / GREATEST(DATEDIFF(NOW(), v.created_at), 1) as engagement_rate
       FROM videos v
       JOIN users u ON v.user_id = u.id
       LEFT JOIN likes l ON v.id = l.video_id
       WHERE v.deleted_by_admin = FALSE 
         AND u.is_banned = FALSE
         AND v.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY v.id
       ORDER BY engagement_rate DESC, likes DESC
       LIMIT ?`,
      [safeDays, safeLimit]
    );
    return rows;
  }

  // ============ الحذف ============
  static async delete(videoId, userId) {
    const [result] = await pool.execute(
      'DELETE FROM videos WHERE id = ? AND user_id = ?',
      [videoId, userId]
    );
    return result.affectedRows > 0;
  }

  // ============ أدوات مساعدة ============
  static removeDuplicateVideos(videos) {
    const seen = new Set();
    return videos.filter(video => {
      if (seen.has(video.id)) {
        return false;
      }
      seen.add(video.id);
      return true;
    });
  }

  static async recordUserInteraction(userId, videoId, interactionType, weight = 1) {
    try {
      await pool.execute(
        `INSERT INTO user_interactions (user_id, video_id, interaction_type, weight, created_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         weight = weight + VALUES(weight),
         updated_at = NOW()`,
        [userId, videoId, interactionType, weight]
      );
      return true;
    } catch (error) {
      console.error('Error in Video.recordUserInteraction:', error);
      return false;
    }
  }

  static async getVideoStats(videoId) {
    try {
      const [rows] = await pool.execute(
        `SELECT 
           COALESCE(v.views, 0) as views,
           COALESCE(v.shares, 0) as shares,
           (SELECT COUNT(*) FROM likes WHERE video_id = ?) as likes_count,
           (SELECT COUNT(*) FROM watch_history WHERE video_id = ?) as watches_count,
           (SELECT AVG(watch_time) FROM watch_history WHERE video_id = ?) as avg_watch_time
         FROM videos v
         WHERE v.id = ?`,
        [videoId, videoId, videoId, videoId]
      );
      return rows[0];
    } catch (error) {
      console.error('Error in Video.getVideoStats:', error);
      return null;
    }
  }

  static async searchVideos(query, userId = null, limit = 20) {
    try {
      // ✅ استخدام قيم افتراضية آمنة
      const safeUserId = userId || 0;
      const safeLimit = parseInt(limit) || 20;

      const [rows] = await pool.execute(
        `SELECT v.*, u.username, u.avatar,
                COUNT(DISTINCT l.user_id) as likes,
                EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
         FROM videos v
         JOIN users u ON v.user_id = u.id
         LEFT JOIN likes l ON v.id = l.video_id
         WHERE (v.description LIKE ? OR u.username LIKE ?)
           AND v.deleted_by_admin = FALSE 
           AND u.is_banned = FALSE
         GROUP BY v.id
         ORDER BY 
           (CASE 
             WHEN v.description LIKE ? THEN 3
             WHEN u.username LIKE ? THEN 2
             ELSE 1
           END) DESC,
           COALESCE(v.views, 0) DESC
         LIMIT ?`,
        [
          safeUserId,
          `%${query}%`,
          `%${query}%`,
          `%${query}%`,
          `%${query}%`,
          safeLimit
        ]
      );
      return rows;
    } catch (error) {
      console.error('Error in Video.searchVideos:', error);
      return [];
    }
  }

  // ============ دوال جديدة لنظام التوصية ============
  static async getUserWatchHistory(userId, limit = 50) {
    try {
      // ✅ استخدام قيم افتراضية آمنة
      const safeLimit = parseInt(limit) || 50;

      const [rows] = await pool.execute(
        `SELECT wh.*, v.*, u.username as video_username 
         FROM watch_history wh
         JOIN videos v ON wh.video_id = v.id
         JOIN users u ON v.user_id = u.id
         WHERE wh.user_id = ? AND v.deleted_by_admin = FALSE
         ORDER BY wh.updated_at DESC
         LIMIT ?`,
        [userId, safeLimit]
      );
      return rows;
    } catch (error) {
      console.error('Error in Video.getUserWatchHistory:', error);
      return [];
    }
  }

  static async getPopularVideosByCategory(category, limit = 10) {
    try {
      // ✅ استخدام قيم افتراضية آمنة
      const safeLimit = parseInt(limit) || 10;

      const [rows] = await pool.execute(
        `SELECT v.*, u.username, u.avatar,
                COUNT(DISTINCT l.user_id) as likes,
                EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
         FROM videos v
         JOIN users u ON v.user_id = u.id
         LEFT JOIN likes l ON v.id = l.video_id
         WHERE v.description LIKE ? 
           AND v.deleted_by_admin = FALSE 
           AND u.is_banned = FALSE
         GROUP BY v.id
         ORDER BY COALESCE(v.views, 0) DESC
         LIMIT ?`,
        [0, `%${category}%`, safeLimit]
      );
      return rows;
    } catch (error) {
      console.error('Error in Video.getPopularVideosByCategory:', error);
      return [];
    }
  }

  static async getRecentlyInteractedVideos(userId, limit = 10) {
    try {
      // ✅ استخدام قيم افتراضية آمنة
      const safeLimit = parseInt(limit) || 10;

      const [rows] = await pool.execute(
        `SELECT v.*, u.username, u.avatar,
                COUNT(DISTINCT l.user_id) as likes,
                EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked,
                MAX(ui.created_at) as last_interaction
         FROM user_interactions ui
         JOIN videos v ON ui.video_id = v.id
         JOIN users u ON v.user_id = u.id
         LEFT JOIN likes l ON v.id = l.video_id
         WHERE ui.user_id = ? 
           AND v.deleted_by_admin = FALSE 
           AND u.is_banned = FALSE
         GROUP BY v.id
         ORDER BY last_interaction DESC
         LIMIT ?`,
        [userId, userId, safeLimit]
      );
      return rows;
    } catch (error) {
      console.error('Error in Video.getRecentlyInteractedVideos:', error);
      return [];
    }
  }

  static async getVideoEngagementRate(videoId) {
    try {
      const [rows] = await pool.execute(
        `SELECT 
           COALESCE(v.views, 0) as views,
           COALESCE(v.shares, 0) as shares,
           (SELECT COUNT(*) FROM likes WHERE video_id = ?) as likes,
           (SELECT COUNT(*) FROM watch_history WHERE video_id = ?) as watches,
           (SELECT COUNT(*) FROM user_interactions WHERE video_id = ?) as interactions
         FROM videos v
         WHERE v.id = ?`,
        [videoId, videoId, videoId, videoId]
      );
      
      const data = rows[0];
      if (!data) return 0;
      
      const totalEngagement = data.likes + data.watches + data.interactions + data.shares;
      const engagementRate = totalEngagement / Math.max(data.views, 1);
      
      return engagementRate;
    } catch (error) {
      console.error('Error in Video.getVideoEngagementRate:', error);
      return 0;
    }
  }

  static async getTopCreatorsByEngagement(limit = 10) {
    try {
      // ✅ استخدام قيم افتراضية آمنة
      const safeLimit = parseInt(limit) || 10;

      const [rows] = await pool.execute(
        `SELECT u.id, u.username, u.avatar,
                COUNT(DISTINCT v.id) as video_count,
                SUM(COALESCE(v.views, 0)) as total_views,
                SUM(COALESCE(v.shares, 0)) as total_shares,
                COUNT(DISTINCT l.id) as total_likes,
                (SUM(COALESCE(v.views, 0)) + COUNT(DISTINCT l.id) + SUM(COALESCE(v.shares, 0))) as engagement_score
         FROM users u
         JOIN videos v ON u.id = v.user_id
         LEFT JOIN likes l ON v.id = l.video_id
         WHERE v.deleted_by_admin = FALSE AND u.is_banned = FALSE
         GROUP BY u.id
         ORDER BY engagement_score DESC
         LIMIT ?`,
        [safeLimit]
      );
      return rows;
    } catch (error) {
      console.error('Error in Video.getTopCreatorsByEngagement:', error);
      return [];
    }
  }
}
