import { executeQuery } from '../config/db.js';
import recommendationEngine from '../services/recommendationEngine.js';

export const exploreController = {
  // جلب فيديوهات الـ Explore
  async getExploreVideos(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        filter = 'recommended',
        search,
        hashtag,
        userId
      } = req.query;

      const offset = (page - 1) * limit;

      // ✅ تحسين جذري: استخدام الأعمدة المخزنة مسبقاً (views, likes) بدلاً من JOINs المكلفة
      let query = `
        SELECT 
          v.*,
          u.username,
          u.avatar,
          v.likes as likes_count,
          (SELECT COUNT(*) FROM comments WHERE video_id = v.id) as comment_count,
          v.views as views_count,
          ${userId ? 'EXISTS(SELECT 1 FROM likes WHERE video_id = v.id AND user_id = ?)' : 'FALSE'} as is_liked,
          ${userId ? 'EXISTS(SELECT 1 FROM follows WHERE following_id = v.user_id AND follower_id = ?)' : 'FALSE'} as is_following
        FROM videos v
        JOIN users u ON v.user_id = u.id
        WHERE v.is_public = true AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE
      `;

      const queryParams = userId ? [userId, userId] : [];

      // تطبيق الفلتر
      if (search) {
        query += ` AND (v.description LIKE ? OR u.username LIKE ?)`;
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      if (hashtag) {
        query += ` AND v.hashtags LIKE ?`;
        queryParams.push(`%${hashtag}%`);
      }

      // تجميع النتائج (لم يعد ضرورياً جداً مع إزالة JOIN l, c, vw لكن نتركه للأمان)
      // query += ` GROUP BY v.id`;

      // تطبيق الترتيب حسب الفلتر
      switch (filter) {
        case 'trending':
          query += ` ORDER BY (v.likes * 0.4 + v.views * 0.3 + (SELECT COUNT(*) FROM comments WHERE video_id = v.id) * 0.3) DESC, v.created_at DESC`;
          break;
        case 'popular':
          query += ` ORDER BY v.views DESC, v.likes DESC`;
          break;
        case 'latest':
          query += ` ORDER BY v.created_at DESC`;
          break;
        case 'recommended':
        default:
          if (userId) {
            try {
              const recommendedVideos = await recommendationEngine.getRecommendedVideos(userId, parseInt(limit));
              return res.json({
                videos: recommendedVideos,
                pagination: { page, limit, hasMore: recommendedVideos.length === parseInt(limit) }
              });
            } catch (recommendationError) {
              query += ` ORDER BY (v.likes * 0.3 + v.views * 0.7) DESC, v.created_at DESC`;
            }
          } else {
            query += ` ORDER BY (v.likes * 0.3 + v.views * 0.7) DESC, v.created_at DESC`;
          }
      }

      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(parseInt(limit), offset);

      const videos = await executeQuery(query, queryParams);

      const formattedVideos = videos.map(video => ({
        id: video.id,
        user_id: video.user_id,
        path: video.path,
        url: video.url || video.video_url || video.path,
        thumbnail: video.thumbnail,
        description: video.description,
        hashtags: video.hashtags ? (typeof video.hashtags === 'string' ? JSON.parse(video.hashtags) : video.hashtags) : [],
        is_public: video.is_public,
        views: parseInt(video.views_count) || 0,
        likes: parseInt(video.likes_count) || 0,
        duration: parseInt(video.duration) || 0,
        created_at: video.created_at,
        username: video.username,
        avatar: video.avatar,
        comment_count: parseInt(video.comment_count) || 0,
        is_liked: Boolean(video.is_liked),
        is_following: Boolean(video.is_following)
      }));

      res.json({
        videos: formattedVideos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: videos.length === parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Explore videos error:', error);
      res.status(500).json({ error: 'Failed to fetch explore videos' });
    }
  },

  // جلب مستخدمي الـ Explore
  async getExploreUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        userId
      } = req.query;

      const offset = (page - 1) * limit;

      // ✅ تحسين جذري: استخدام الأعمدة المخزنة مسبقاً في جدول users بدلاً من JOINs المكلفة
      let query = `
        SELECT 
          u.*,
          COALESCE(u.followers_count, 0) as followers_count,
          COALESCE(u.following_count, 0) as following_count,
          COALESCE(u.likes_count, 0) as likes_count,
          COALESCE(u.views_count, 0) as views_count,
          COALESCE(u.total_watch_time, 0) as total_watch_time,
          ${userId ? 'EXISTS(SELECT 1 FROM follows WHERE following_id = u.id AND follower_id = ?)' : 'FALSE'} as is_following
        FROM users u
        WHERE u.is_banned = false
      `;

      const queryParams = userId ? [userId] : [];

      if (search) {
        query += ` AND (u.username LIKE ? OR u.bio LIKE ?)`;
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      query += ` 
        ORDER BY 
          (COALESCE(u.followers_count, 0) * 0.4 + 
           COALESCE(u.likes_count, 0) * 0.3 + 
           COALESCE(u.views_count, 0) * 0.3) DESC,
          u.created_at DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(parseInt(limit), offset);

      const users = await executeQuery(query, queryParams);

      const formattedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        social_links: user.social_links ? (typeof user.social_links === 'string' ? JSON.parse(user.social_links) : user.social_links) : {},
        followers_count: parseInt(user.followers_count) || 0,
        following_count: parseInt(user.following_count) || 0,
        likes_count: parseInt(user.likes_count) || 0,
        views_count: parseInt(user.views_count) || 0,
        total_watch_time: parseInt(user.total_watch_time) || 0,
        is_following: Boolean(user.is_following),
        created_at: user.created_at
      }));

      res.json({
        users: formattedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: users.length === parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Explore users error:', error);
      res.status(500).json({ error: 'Failed to fetch explore users' });
    }
  },

  // البحث الشامل في الـ Explore
  async searchExplore(req, res) {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const searchQuery = `%${query}%`;

      // البحث في الفيديوهات
      const videos = await executeQuery(`
        SELECT 
          v.*,
          u.username,
          u.avatar,
          COUNT(DISTINCT l.user_id) as likes,
          COUNT(DISTINCT c.id) as comment_count,
          COUNT(DISTINCT vw.id) as views
        FROM videos v
        LEFT JOIN users u ON v.user_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id
        LEFT JOIN comments c ON v.id = c.video_id
        LEFT JOIN video_views vw ON v.id = vw.video_id
        WHERE v.is_public = true AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE
          AND (v.description LIKE ? OR u.username LIKE ?)
        GROUP BY v.id
        ORDER BY (COUNT(DISTINCT l.user_id) + COUNT(DISTINCT vw.id)) DESC
        LIMIT ?
      `, [searchQuery, searchQuery, parseInt(limit)]);

      // البحث في المستخدمين
      const users = await executeQuery(`
        SELECT 
          u.*,
          COUNT(DISTINCT f.follower_id) as followers_count
        FROM users u
        LEFT JOIN followers f ON u.id = f.following_id
        WHERE u.is_banned = false 
          AND (u.username LIKE ? OR u.bio LIKE ?)
        GROUP BY u.id
        ORDER BY COUNT(DISTINCT f.follower_id) DESC
        LIMIT ?
      `, [searchQuery, searchQuery, parseInt(limit)]);

      res.json({
        videos: videos.slice(0, 5),
        users: users.slice(0, 5),
        hashtags: []
      });

    } catch (error) {
      console.error('Explore search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  },

  // جلب الهاشتاجات الشائعة
  async getTrendingHashtags(req, res) {
    try {
      const { limit = 10 } = req.query;

      const hashtags = await executeQuery(`
        SELECT 
          hashtag as name,
          COUNT(*) as count,
          COUNT(*) > 10 as trending
        FROM (
          SELECT 
            JSON_UNQUOTE(JSON_EXTRACT(v.hashtags, CONCAT('$[', numbers.n, ']'))) as hashtag
          FROM videos v
          JOIN (
            SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
            UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
          ) numbers
          WHERE v.hashtags IS NOT NULL 
            AND JSON_LENGTH(v.hashtags) > numbers.n
            AND v.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            AND v.deleted_by_admin = FALSE
        ) AS extracted_hashtags
        WHERE hashtag IS NOT NULL AND hashtag != ''
        GROUP BY hashtag
        ORDER BY count DESC, hashtag ASC
        LIMIT ?
      `, [parseInt(limit)]);

      res.json({ hashtags });

    } catch (error) {
      console.error('Trending hashtags error:', error);
      res.status(500).json({ error: 'Failed to fetch trending hashtags' });
    }
  },

  // جلب إحصائيات الـ Explore
  async getExploreStats(req, res) {
    try {
      const totalVideosResult = await executeQuery(
        'SELECT COUNT(*) as total_videos FROM videos WHERE is_public = true AND deleted_by_admin = FALSE'
      );
      const totalUsersResult = await executeQuery(
        'SELECT COUNT(*) as total_users FROM users WHERE is_banned = false'
      );
      const dailyViewsResult = await executeQuery(
        'SELECT COUNT(*) as daily_views FROM video_views WHERE created_at >= CURDATE()'
      );

      const total_videos = parseInt(totalVideosResult[0]?.total_videos) || 0;
      const total_users = parseInt(totalUsersResult[0]?.total_users) || 0;
      const daily_views = parseInt(dailyViewsResult[0]?.daily_views) || 0;

      res.json({
        total_videos,
        total_users,
        daily_views,
        trending_hashtags: []
      });

    } catch (error) {
      console.error('Explore stats error:', error);
      res.status(500).json({ error: 'Failed to fetch explore stats' });
    }
  },

  // تسجيل مشاهدة من الـ Explore
  async recordExploreView(req, res) {
    try {
      const { videoId, source = 'explore' } = req.body;
      const userId = req.user?.id;

      await executeQuery(
        'INSERT INTO explore_views (user_id, video_id, source) VALUES (?, ?, ?)',
        [userId, videoId, source]
      );

      res.json({ success: true });

    } catch (error) {
      console.error('Record explore view error:', error);
      res.status(500).json({ error: 'Failed to record view' });
    }
  }
};

export default exploreController;