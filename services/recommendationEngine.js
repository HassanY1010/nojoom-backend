import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { Video } from '../models/Video.js';

class RecommendationEngine {
  constructor() {
    this.weights = {
      like: 2.0,
      share: 1.5,
      watch_complete: 2.0,
      watch_partial: 1.0,
      follow: 1.5,
      comment: 1.2,
      report: -2.0,
      view: 0.5
    };
    
    this.minWatchTimeForScore = 10; // 10 seconds minimum to count as engagement
    this.completionThreshold = 0.8; // 80% watched counts as completed
  }

  /**
   * تسجيل تفاعل المستخدم في النظام
   */
  async recordInteraction(interaction) {
    try {
      // --- الحل النهائي والسليم ---
      // إذا لم يكن هناك videoId (مثل follow) نخليه null
      const safeVideoId = interaction.videoId ?? null;

      const { userId, type, weight, metadata, timestamp } = interaction;

      console.log(`📝 Recording interaction: ${type} for user ${userId}, video ${safeVideoId}`);

      const result = await pool.execute(
        `INSERT INTO user_interactions 
          (user_id, video_id, interaction_type, weight, metadata, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          safeVideoId, // 🔥 الآن 100% ليس undefined
          type,
          weight || this.weights[type] || 1.0,
          JSON.stringify(metadata || {}),
          timestamp || new Date()
        ]
      );

      console.log(`✅ Successfully recorded interaction: ${type}`);
      return { success: true, id: result[0].insertId };

    } catch (error) {
      console.error('❌ Error recording interaction:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        console.log('⚠️ Interaction already recorded, skipping...');
        return { success: true, duplicate: true };
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * تحليل اهتمامات المستخدم بناءً على تفاعلاته
   */
  async analyzeUserInterests(userId) {
    try {
      console.log(`🔍 Analyzing interests for user: ${userId}`);

      // الحصول على تفاعلات المستخدم
      const [interactions] = await pool.execute(
        `SELECT ui.*, v.description, v.user_id as video_owner_id 
         FROM user_interactions ui 
         LEFT JOIN videos v ON ui.video_id = v.id 
         WHERE ui.user_id = ? 
         ORDER BY ui.created_at DESC 
         LIMIT 100`,
        [userId]
      );

      // الحصول على سجل المشاهدة
      const [watchHistory] = await pool.execute(
        `SELECT wh.*, v.description, v.user_id as video_owner_id 
         FROM watch_history wh 
         LEFT JOIN videos v ON wh.video_id = v.id 
         WHERE wh.user_id = ? 
         ORDER BY wh.updated_at DESC 
         LIMIT 50`,
        [userId]
      );

      // الحصول على المتابَعين
      const [following] = await pool.execute(
        `SELECT following_id FROM followers WHERE follower_id = ?`,
        [userId]
      );

      const interests = {
        categories: {},
        creators: {},
        tags: {},
        watchPatterns: {},
        totalScore: 0
      };

      // تحليل التفاعلات
      for (const interaction of interactions) {
        const weight = interaction.weight;
        
        if (interaction.video_id && interaction.description) {
          this.analyzeVideoContent(interaction.description, interests, weight);
        }
        
        // تفضيل المنشئين
        if (interaction.video_owner_id) {
          interests.creators[interaction.video_owner_id] = 
            (interests.creators[interaction.video_owner_id] || 0) + weight;
        }
      }

      // تحليل سجل المشاهدة
      for (const watch of watchHistory) {
        if (watch.video_id && watch.description) {
          const watchWeight = this.calculateWatchWeight(watch.watch_time, watch.completed);
          this.analyzeVideoContent(watch.description, interests, watchWeight);
          
          // تحليل أنماط المشاهدة
          if (watch.video_owner_id) {
            interests.watchPatterns[watch.video_owner_id] = 
              (interests.watchPatterns[watch.video_owner_id] || 0) + watchWeight;
          }
        }
      }

      // تحليل المتابَعين
      for (const follow of following) {
        interests.creators[follow.following_id] = 
          (interests.creators[follow.following_id] || 0) + this.weights.follow;
      }

      // تطبيع النتائج
      this.normalizeInterests(interests);

      console.log(`✅ Interests analysis completed for user: ${userId}`);
      return interests;
    } catch (error) {
      console.error('❌ Error analyzing user interests:', error);
      return this.getDefaultInterests();
    }
  }

  /**
   * تحليل محتوى الفيديو لاستخراج الاهتمامات
   */
  analyzeVideoContent(description, interests, weight) {
    if (!description) return;

    // تنظيف النص واستخراج الكلمات المفتاحية
    const words = description.toLowerCase()
      .replace(/[^\w\s#]/g, ' ') // إزالة الرموز الخاصة مع الاحتفاظ بـ #
      .split(/\s+/)
      .filter(word => word.length > 2);

    const commonWords = new Set([
      'the', 'and', 'for', 'with', 'this', 'that', 'have', 'from', 'your', 'you', 'are', 'this', 'that'
    ]);
    
    for (const word of words) {
      if (!commonWords.has(word)) {
        // معالجة الهاشتاجات
        if (word.startsWith('#')) {
          const tag = word.slice(1);
          if (tag.length > 1) {
            interests.tags[tag] = (interests.tags[tag] || 0) + weight;
            interests.totalScore += weight;
          }
        } else {
          interests.tags[word] = (interests.tags[word] || 0) + weight;
          interests.totalScore += weight;
        }
      }
    }
  }

  /**
   * حساب وزن المشاهدة بناءً على المدة والإكمال
   */
  calculateWatchWeight(watchTime, completed) {
    if (completed) {
      return this.weights.watch_complete;
    }
    
    if (watchTime < this.minWatchTimeForScore) {
      return 0; // لا تعتبر تفاعلاً إذا كانت المدة أقل من الحد الأدنى
    }
    
    // وزن تدريجي بناءً على مدة المشاهدة
    const partialWeight = Math.min(watchTime / 60, this.weights.watch_partial);
    return partialWeight;
  }

  /**
   * تطبيع نتائج الاهتمامات
   */
  normalizeInterests(interests) {
    // تطبيع التاجات
    const tagScores = Object.values(interests.tags);
    if (tagScores.length > 0) {
      const maxTagScore = Math.max(...tagScores);
      for (const key in interests.tags) {
        interests.tags[key] = interests.tags[key] / maxTagScore;
      }
    }

    // تطبيع المنشئين
    const creatorScores = Object.values(interests.creators);
    if (creatorScores.length > 0) {
      const maxCreatorScore = Math.max(...creatorScores);
      for (const key in interests.creators) {
        interests.creators[key] = interests.creators[key] / maxCreatorScore;
      }
    }

    // تطبيع أنماط المشاهدة
    const watchScores = Object.values(interests.watchPatterns);
    if (watchScores.length > 0) {
      const maxWatchScore = Math.max(...watchScores);
      for (const key in interests.watchPatterns) {
        interests.watchPatterns[key] = interests.watchPatterns[key] / maxWatchScore;
      }
    }
  }

// recommendationEngine.js أو Video.js
async getFollowingVideos(userId, followingIds, limit = 10) {
  // 1️⃣ التأكد من أن userId صحيح
  const parsedUserId = parseInt(userId);
  if (!parsedUserId) return [];

  // 2️⃣ تنظيف قائمة المتابعين
  const cleanIds = Array.isArray(followingIds)
    ? followingIds.map(id => parseInt(id)).filter(id => Number.isInteger(id) && id > 0)
    : [];

  if (cleanIds.length === 0) return [];

  // 3️⃣ توليد placeholders
  const placeholders = cleanIds.map(() => '?').join(',');

  // 4️⃣ الاستعلام
  const sql = `
    SELECT v.*, u.username, u.avatar,
           COUNT(DISTINCT l.user_id) AS likes,
           EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) AS is_liked
    FROM videos v
    JOIN users u ON v.user_id = u.id
    LEFT JOIN likes l ON v.id = l.video_id
    WHERE v.user_id IN (${placeholders})
      AND v.deleted_by_admin = FALSE
      AND u.is_banned = FALSE
    GROUP BY v.id
    ORDER BY v.created_at DESC
    LIMIT ?`;

  // 5️⃣ إعداد الباراميترات
  const params = [parsedUserId, ...cleanIds, parseInt(limit)];

  console.log(`🔍 getFollowingVideos → ${params.length} params`, params);

  try {
    const [rows] = await pool.execute(sql, params);

    // 6️⃣ توليد روابط الفيديو و thumbnails كاملة من Supabase
    const videosWithUrls = rows.map(video => ({
      ...video,
      video_url: `${process.env.SUPABASE_URL}/storage/v1/object/public/videos/${video.path}`,
      thumbnail_url: video.thumbnail 
        ? `${process.env.SUPABASE_URL}/storage/v1/object/public/avatars/${video.thumbnail}`
        : '/default-thumbnail.jpg'
    }));

    return videosWithUrls;

  } catch (err) {
    console.error('❌ getFollowingVideos error:', err);
    return [];
  }
}


async getPopularVideos(userId, limit) {
  const safeUserId = parseInt(userId) || 0;
  const safeLimit  = parseInt(limit)  || 10;

  const sql = `
    SELECT v.*, u.username, u.avatar,
           COUNT(DISTINCT l.user_id) AS likes,
           EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) AS is_liked
    FROM videos v
    JOIN users u ON v.user_id = u.id
    LEFT JOIN likes l ON v.id = l.video_id
    WHERE v.deleted_by_admin = FALSE
      AND u.is_banned = FALSE
    GROUP BY v.id
    ORDER BY v.views DESC, v.created_at DESC
    LIMIT ?`;

  console.log(`🔍 getPopularVideos → user:${safeUserId}  limit:${safeLimit}`);

  try {
    const [rows] = await pool.execute(sql, [safeUserId, safeLimit]);
    return rows;
  } catch (err) {
    console.error('❌ getPopularVideos error:', err);
    return [];
  }
}

async getRecommendedVideos(userId, limit = 10) {
  try {
    const safeUserId = parseInt(userId) || 0;
    const safeLimit = parseInt(limit) || 10;

    console.log(`🎯 Generating recommendations for user: ${safeUserId}`);

    // الحصول على قائمة المتابعين
    const [following] = await pool.execute(
      'SELECT following_id FROM followers WHERE follower_id = ?',
      [safeUserId]
    );
    const followingIds = following.map(f => f.following_id).filter(id => id != null);

    // تحديد الأقسام المختلفة بناءً على حالة المستخدم
    let followingLimit = 0;
    let interestLimit = 0;
    let popularLimit = 0;

    if (followingIds.length > 0) {
      // إذا كان المستخدم يتابع أشخاص
      followingLimit = Math.floor(safeLimit * 0.4);
      interestLimit = Math.floor(safeLimit * 0.4);
      popularLimit = Math.floor(safeLimit * 0.2);
    } else {
      // إذا لم يكن يتابع أحداً
      followingLimit = 0;
      interestLimit = Math.floor(safeLimit * 0.5);
      popularLimit = Math.floor(safeLimit * 0.5);
    }

    const followingVideos = await this.getFollowingVideos(safeUserId, followingIds, followingLimit);
    
    let interestBasedVideos = [];
    try {
      const userInterests = await this.analyzeUserInterests(safeUserId);
      interestBasedVideos = await this.getInterestBasedVideos(safeUserId, userInterests, interestLimit);
    } catch (interestError) {
      console.warn('⚠️ Could not get interest-based videos, using popular instead:', interestError.message);
    }
    
    const popularVideos = await this.getPopularVideos(safeUserId, popularLimit);

    const allVideos = [...followingVideos, ...interestBasedVideos, ...popularVideos];
    const uniqueVideos = this.removeDuplicates(allVideos);

    console.log(`✅ Generated ${uniqueVideos.length} recommendations for user: ${safeUserId}`);
    return uniqueVideos.slice(0, safeLimit);

  } catch (error) {
    console.error('❌ Error getting recommended videos:', error);
    // Fallback to popular videos only
    return await this.getPopularVideos(parseInt(userId) || 0, parseInt(limit) || 10);
  }
}

  /**
   * الحصول على فيديوهات بناءً على الاهتمامات
   */
  async getInterestBasedVideos(userId, interests, limit) {
  try {
    const topTags = Object.entries(interests.tags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    if (!topTags || topTags.length === 0) return [];

    const searchTerms = topTags.map(t => `%${t}%`);
    const placeholders = searchTerms.map(() => 'v.description LIKE ?').join(' OR ');

    const params = [userId, ...searchTerms, parseInt(limit)];
    const sql = `
      SELECT v.*, u.username, u.avatar,
             COUNT(DISTINCT l.user_id) as likes,
             EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
      FROM videos v
      JOIN users u ON v.user_id = u.id
      LEFT JOIN likes l ON v.id = l.video_id
      WHERE (${placeholders})
        AND v.deleted_by_admin = FALSE 
        AND u.is_banned = FALSE
      GROUP BY v.id
      ORDER BY v.views DESC, v.created_at DESC
      LIMIT ?`;

    const [videos] = await pool.execute(sql, params);
    return videos;
  } catch (error) {
    console.error('Error getting interest-based videos:', error);
    return [];
  }
}
  /**
   * الحصول على الفيديوهات الشائعة
   */
    
  /**
   * إزالة الفيديوهات المكررة
   */
  removeDuplicates(videos) {
    const seen = new Set();
    return videos.filter(video => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    });
  }

  /**
   * تقييم الفيديوهات بناءً على اهتمامات المستخدم
   */
  async scoreVideos(videos, interests, followingIds, userId) {
    return videos.map(video => {
      let score = 0;

      // درجة الأساس: الإعجابات والمشاهدات
      score += Math.log10((video.likes || 0) + 1) * 0.3;
      score += Math.log10((video.views || 0) + 1) * 0.2;

      // درجة المتابعة (أولوية عالية للمتابَعين)
      if (followingIds.includes(video.user_id)) {
        score += 2.0;
      }

      // درجة الاهتمامات بناءً على الوصف
      if (video.description) {
        const videoWords = new Set(video.description.toLowerCase().split(/\s+/));
        for (const [tag, tagScore] of Object.entries(interests.tags)) {
          if (videoWords.has(tag)) {
            score += tagScore * 0.8;
          }
        }
      }

      // درجة المنشئ المفضل
      if (interests.creators[video.user_id]) {
        score += interests.creators[video.user_id] * 1.2;
      }

      // عامل الحداثة (تفضيل المحتوى الجديد)
      const videoDate = new Date(video.created_at);
      const daysOld = (Date.now() - videoDate.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - (daysOld / 30)); // تقل الأولوية بعد 30 يوم
      score += recencyScore * 0.5;

      return { 
        ...video, 
        recommendation_score: parseFloat(score.toFixed(2)),
        score_breakdown: {
          engagement: Math.log10((video.likes || 0) + 1) * 0.3 + Math.log10((video.views || 0) + 1) * 0.2,
          following: followingIds.includes(video.user_id) ? 2.0 : 0,
          interests: score - (Math.log10((video.likes || 0) + 1) * 0.3 + Math.log10((video.views || 0) + 1) * 0.2) - (followingIds.includes(video.user_id) ? 2.0 : 0),
          recency: recencyScore * 0.5
        }
      };
    }).sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  /**
   * الحصول على فيديوهات مشابهة
   */
  async getSimilarVideos(videoId, userId = null, limit = 10) {
    try {
      // الحصول على الفيديو الحالي
      const [currentVideo] = await pool.execute(
        'SELECT * FROM videos WHERE id = ? AND deleted_by_admin = FALSE',
        [videoId]
      );
      
      if (currentVideo.length === 0) return [];
      
      const video = currentVideo[0];
      const firstWord = video.description?.split(' ')[0] || '';
      
      // البحث عن فيديوهات مشابهة
      const [similarVideos] = await pool.execute(
        `SELECT v.*, u.username, u.avatar,
                COUNT(DISTINCT l.user_id) as likes,
                EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
         FROM videos v
         JOIN users u ON v.user_id = u.id
         LEFT JOIN likes l ON v.id = l.video_id
         WHERE v.id != ? 
           AND v.deleted_by_admin = FALSE 
           AND u.is_banned = FALSE
           AND (v.description LIKE ? OR v.user_id = ?)
         GROUP BY v.id
         ORDER BY v.views DESC
         LIMIT ?`,
        [userId || 0, videoId, `%${firstWord}%`, video.user_id, limit]
      );
      
      return similarVideos;
    } catch (error) {
      console.error('Error getting similar videos:', error);
      return [];
    }
  }

  /**
   * تحديث نموذج التوصية للمستخدم
   */
  async updateUserModel(userId) {
    try {
      const interests = await this.analyzeUserInterests(userId);
      
      // هنا يمكن حفظ نموذج المستخدم في قاعدة البيانات للاستخدام المستقبلي
      console.log(`✅ Updated user model for: ${userId}`);
      
      return interests;
    } catch (error) {
      console.error('Error updating user model:', error);
      throw error;
    }
  }

  /**
   * اهتمامات افتراضية
   */
  getDefaultInterests() {
    return {
      categories: {},
      creators: {},
      tags: {},
      watchPatterns: {},
      totalScore: 0
    };
  }

  /**
   * الحصول على إحصائيات التوصية
   */
  async getRecommendationStats(userId) {
    try {
      const [interactionCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM user_interactions WHERE user_id = ?',
        [userId]
      );
      
      const [watchHistoryCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM watch_history WHERE user_id = ?',
        [userId]
      );
      
      const [followingCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM followers WHERE follower_id = ?',
        [userId]
      );
      
      return {
        interactions: interactionCount[0].count,
        watchHistory: watchHistoryCount[0].count,
        following: followingCount[0].count,
        modelUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting recommendation stats:', error);
      return {
        interactions: 0,
        watchHistory: 0,
        following: 0,
        modelUpdated: new Date()
      };
    }
  }
}

// ✅ إنشاء instance من RecommendationEngine
const recommendationEngine = new RecommendationEngine();

// ✅ التصدير الصحيح
export { recommendationEngine, RecommendationEngine };
export default recommendationEngine;
