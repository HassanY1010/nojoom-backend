// services/searchService.js
import { pool, executeQuery } from '../config/db.js';

class SearchService {
  // البحث في الفيديوهات
  async searchVideos({ query, hashtags, filter, userId, limit, offset }) {
    let whereConditions = ['v.is_public = true', 'v.deleted_by_admin = false', 'u.is_banned = false'];
    let orderBy = '';
    const params = [];

    if (query) {
      whereConditions.push('(v.description LIKE ? OR v.title LIKE ? OR u.username LIKE ?)');
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }

    if (hashtags?.length) {
      const hashtagCond = hashtags.map(() => 'v.description LIKE ?').join(' OR ');
      whereConditions.push(`(${hashtagCond})`);
      hashtags.forEach(t => params.push(`%${t}%`));
    }

    switch (filter) {
      case 'trending': orderBy = 'v.views DESC, v.likes DESC, v.created_at DESC'; break;
      case 'latest': orderBy = 'v.created_at DESC'; break;
      default: orderBy = 'v.created_at DESC';
    }

    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const sql = `
    SELECT 
      v.*, u.id as user_id, u.username, u.avatar, u.bio,
      v.likes as likes_count,
      (SELECT COUNT(*) FROM comments c WHERE c.video_id = v.id) as comment_count,
      ${userId ? '(SELECT EXISTS(SELECT 1 FROM likes l WHERE l.video_id = v.id AND l.user_id = ?))' : 'FALSE'} as is_liked
    FROM videos v
    JOIN users u ON v.user_id = u.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
  `;

    return await executeQuery(sql, userId ? [userId, ...params] : params);
  }

  async searchUsers({ query, userId, limit, offset }) {
    const params = [];
    let whereConditions = ['u.is_banned = false'];

    if (query) {
      whereConditions.push('(u.username LIKE ? OR u.bio LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }

    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const sql = `
    SELECT 
      u.*,
      COALESCE(u.followers_count, 0) as followers_count,
      COALESCE(u.following_count, 0) as following_count,
      ${userId ? '(SELECT EXISTS(SELECT 1 FROM follows f WHERE f.following_id = u.id AND f.follower_id = ?))' : 'FALSE'} as is_following
    FROM users u
    ${whereClause}
    ORDER BY u.username ASC
    LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
  `;

    return await executeQuery(sql, userId ? [userId, ...params] : params);
  }

  async searchByHashtag(hashtag, userId, limit, offset) {
    const sql = `
    SELECT 
      v.*, u.id as user_id, u.username, u.avatar,
      (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) as likes_count,
      (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.video_id = v.id AND l.user_id = ?)) as is_liked
    FROM videos v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE v.status = 'active' AND v.description LIKE ?
    ORDER BY v.created_at DESC
    LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
  `;
    return await executeQuery(sql, [userId || 0, `%${hashtag}%`]);
  }

  // الحصول على الهاشتاجات الرائجة
  async getTrendingHashtags(limit = 10) {
    try {
      const sql = `
        SELECT description 
        FROM videos 
        WHERE status = 'active' 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `;

      const videos = await executeQuery(sql);

      // استخراج الهاشتاجات وتحليل التكرار
      const hashtagCount = {};
      videos.forEach(video => {
        const matches = video.description?.match(/#[\w\u0600-\u06FF]+/g) || [];
        matches.forEach(hashtag => {
          hashtagCount[hashtag] = (hashtagCount[hashtag] || 0) + 1;
        });
      });

      // ترتيب حسب التكرار
      const sortedHashtags = Object.entries(hashtagCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([hashtag]) => hashtag.replace('#', ''));

      return sortedHashtags;
    } catch (error) {
      console.error('Trending hashtags error:', error);
      throw error;
    }
  }

  // الاقتراحات التلقائية
  async getSearchSuggestions(query, limit = 5) {
    try {
      const [users, videos, hashtags] = await Promise.all([
        // اقتراحات المستخدمين
        executeQuery(
          'SELECT username FROM users WHERE username LIKE ? AND status = "active" LIMIT ?',
          [`%${query}%`, Math.floor(limit / 2)]
        ),

        // اقتراحات الفيديوهات
        executeQuery(
          'SELECT description FROM videos WHERE description LIKE ? AND status = "active" LIMIT ?',
          [`%${query}%`, Math.floor(limit / 2)]
        ),

        // اقتراحات الهاشتاجات
        this.getTrendingHashtags(3)
      ]);

      const suggestions = [
        ...users.map(user => ({ type: 'user', text: `@${user.username}` })),
        ...videos.map(video => ({
          type: 'video',
          text: video.description && video.description.length > 30
            ? video.description.substring(0, 30) + '...'
            : video.description
        })),
        ...hashtags.map(hashtag => ({ type: 'hashtag', text: `#${hashtag}` }))
      ];

      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Search suggestions error:', error);
      throw error;
    }
  }

  // تسجيل تفاعل البحث
  async recordSearchInteraction(userId, videoId, type, weight, metadata) {
    try {
      const sql = `
        INSERT INTO search_interactions (user_id, video_id, interaction_type, weight, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;
      await executeQuery(sql, [userId, videoId, type, weight, JSON.stringify(metadata || {})]);
    } catch (error) {
      console.error('Record search interaction error:', error);
      throw error;
    }
  }

  // تسجيل تاريخ البحث
  async recordSearchHistory(userId, query, searchType) {
    try {
      const sql = `
        INSERT INTO search_history (user_id, query, search_type, created_at)
        VALUES (?, ?, ?, NOW())
      `;
      await executeQuery(sql, [userId, query, searchType]);
    } catch (error) {
      console.error('Record search history error:', error);
      // لا نرمي خطأ هنا لأنه غير حرج
    }
  }

  // الحصول على تاريخ البحث
  async getUserSearchHistory(userId, limit = 10) {
    try {
      const sql = `
        SELECT query, search_type, created_at 
        FROM search_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      const history = await executeQuery(sql, [userId, limit]);
      return history;
    } catch (error) {
      console.error('Get search history error:', error);
      throw error;
    }
  }

  // مسح تاريخ البحث
  async clearUserSearchHistory(userId) {
    try {
      const sql = 'DELETE FROM search_history WHERE user_id = ?';
      await executeQuery(sql, [userId]);
    } catch (error) {
      console.error('Clear search history error:', error);
      throw error;
    }
  }

  // التوصيات بناءً على البحث
  async getSearchBasedRecommendations(query, userId, limit = 5) {
    try {
      const relatedTags = await this.extractRelatedTags(query);

      let recommendations = [];

      if (userId) {
        recommendations = await this.getPersonalizedRecommendations(userId, relatedTags, limit);
      } else {
        recommendations = await this.getGeneralRecommendations(relatedTags, limit);
      }

      return recommendations;
    } catch (error) {
      console.error('Search recommendations error:', error);
      throw error;
    }
  }

  // استخراج الوسوم ذات الصلة
  async extractRelatedTags(query) {
    if (!query) return [];

    const commonTags = {
      'music': ['song', 'artist', 'band', 'music'],
      'sports': ['football', 'basketball', 'soccer', 'game'],
      'comedy': ['funny', 'joke', 'humor', 'comedy'],
      'education': ['learn', 'tutorial', 'howto', 'education']
    };

    const tags = [];
    const lowerQuery = query.toLowerCase();

    Object.entries(commonTags).forEach(([category, related]) => {
      if (related.some(tag => lowerQuery.includes(tag))) {
        tags.push(category);
      }
    });

    return tags;
  }

  // التوصيات المخصصة
  async getPersonalizedRecommendations(userId, tags, limit) {
    try {
      let whereCondition = 'v.status = "active"';
      const params = [];

      if (tags.length > 0) {
        const tagConditions = tags.map(() => 'v.description LIKE ?');
        whereCondition += ` AND (${tagConditions.join(' OR ')})`;
        tags.forEach(tag => params.push(`%${tag}%`));
      }

      const sql = `
        SELECT 
          v.*,
          u.id as user_id,
          u.username,
          u.avatar,
          (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) as likes_count
        FROM videos v
        LEFT JOIN users u ON v.user_id = u.id
        WHERE ${whereCondition}
        ORDER BY v.views DESC, v.created_at DESC
        LIMIT ?
      `;

      const results = await executeQuery(sql, [...params, limit]);
      return results;
    } catch (error) {
      console.error('Personalized recommendations error:', error);
      throw error;
    }
  }

  // التوصيات العامة
  async getGeneralRecommendations(tags, limit) {
    try {
      let whereCondition = 'v.status = "active"';
      const params = [];

      if (tags.length > 0) {
        const tagConditions = tags.map(() => 'v.description LIKE ?');
        whereCondition += ` AND (${tagConditions.join(' OR ')})`;
        tags.forEach(tag => params.push(`%${tag}%`));
      }

      const sql = `
        SELECT 
          v.*,
          u.id as user_id,
          u.username,
          u.avatar,
          (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) as likes_count
        FROM videos v
        LEFT JOIN users u ON v.user_id = u.id
        WHERE ${whereCondition}
        ORDER BY v.views DESC, v.created_at DESC
        LIMIT ?
      `;

      const results = await executeQuery(sql, [...params, limit]);
      return results;
    } catch (error) {
      console.error('General recommendations error:', error);
      throw error;
    }
  }
}

export default new SearchService();