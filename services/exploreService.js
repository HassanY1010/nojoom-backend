const db = require('../config/database');

const exploreService = {
  // حساب درجة الشعبية للفيديو
  calculateVideoPopularity(video) {
    const likesWeight = 0.4;
    const viewsWeight = 0.3;
    const commentsWeight = 0.2;
    const recencyWeight = 0.1;

    const recencyScore = Math.max(0, 1 - (Date.now() - new Date(video.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    return (
      (video.likes * likesWeight) +
      (video.views * viewsWeight) +
      (video.comment_count * commentsWeight) +
      (recencyScore * recencyWeight)
    );
  },

  // حساب درجة الشعبية للمستخدم
  calculateUserPopularity(user) {
    const followersWeight = 0.5;
    const engagementWeight = 0.3;
    const recencyWeight = 0.2;

    const engagementRate = user.likes_count / Math.max(user.followers_count, 1);
    const recencyScore = Math.max(0, 1 - (Date.now() - new Date(user.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000));
    
    return (
      (user.followers_count * followersWeight) +
      (engagementRate * engagementWeight * 1000) + // تضخيم المعدل
      (recencyScore * recencyWeight)
    );
  },

  // استخراج الهاشتاجات من وصف الفيديو
  extractHashtags(description) {
    if (!description) return [];
    const hashtagRegex = /#(\w+)/g;
    const matches = description.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  },

  // الحصول على الفيديوهات المميزة
  async getFeaturedVideos(limit = 5) {
    try {
      const [videos] = await db.execute(`
        SELECT 
          v.*,
          u.username,
          u.avatar,
          COUNT(DISTINCT l.id) as likes,
          COUNT(DISTINCT c.id) as comment_count,
          COUNT(DISTINCT vw.id) as views
        FROM videos v
        LEFT JOIN users u ON v.user_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id
        LEFT JOIN comments c ON v.id = c.video_id
        LEFT JOIN video_views vw ON v.id = vw.video_id
        WHERE v.is_public = true
        GROUP BY v.id
        HAVING likes >= 10 AND views >= 50
        ORDER BY (likes * 0.6 + views * 0.4) DESC
        LIMIT ?
      `, [limit]);

      return videos;
    } catch (error) {
      console.error('Get featured videos error:', error);
      return [];
    }
  },

  // الحصول على المستخدمين النشطين
  async getActiveUsers(limit = 10) {
    try {
      const [users] = await db.execute(`
        SELECT 
          u.*,
          COUNT(DISTINCT v.id) as video_count,
          COUNT(DISTINCT f.id) as followers_count
        FROM users u
        LEFT JOIN videos v ON u.id = v.user_id
        LEFT JOIN follows f ON u.id = f.following_id
        WHERE u.is_banned = false
          AND v.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY u.id
        ORDER BY video_count DESC, followers_count DESC
        LIMIT ?
      `, [limit]);

      return users;
    } catch (error) {
      console.error('Get active users error:', error);
      return [];
    }
  }
};

module.exports = exploreService;