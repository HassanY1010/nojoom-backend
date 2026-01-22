import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';

export class User {
  // ============ الأساسية ============
  static async create(userData) {
    const {
      username,
      email,
      password,
      role = 'user',
      avatar = '/uploads/avatars/default-avatar.png',
      bio = '',
      birthDate,
      birthDay,
      birthMonth,
      birthYear
    } = userData;

    // 🔥 كلمات السر مشفرة باستخدام bcrypt لحماية أمن المستخدمين
    const salt = await bcrypt.genSalt(10);
    const finalPassword = await bcrypt.hash(password, salt);

    const [result] = await pool.execute(
      `INSERT INTO users 
     (username, email, password, avatar, bio, email_verified, language, theme, role, total_watch_time, birth_date, birth_day, birth_month, birth_year) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        email,
        finalPassword,   // <<< مهم جداً
        avatar,
        bio,
        false,
        'en',
        'dark',
        role,            // <<< حتى يميز بين admin و user
        0,
        birthDate,
        birthDay,
        birthMonth,
        birthYear
      ]
    );

    return result.insertId;
  }


  // ✅ دوال أخرى موجودة مسبقاً...
  static async findByEmail(email) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0];
  }

  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT id, username, email, avatar, bio, social_links, followers_count, following_count, likes_count, views_count, total_watch_time, role, email_verified, language, theme, is_banned, ban_reason, created_at, last_login, birth_date, birth_day, birth_month, birth_year, is_private, allow_dms, show_activity_status FROM users WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      console.error('Error in User.findById:', error);
      throw error;
    }
  }

  static async findByUsername(username) {
    try {
      const [rows] = await pool.execute(
        'SELECT id, username, email FROM users WHERE username = ?',
        [username]
      );
      return rows[0];
    } catch (error) {
      console.error('Error in User.findByUsername:', error);
      throw error;
    }
  }

  static async validatePassword(plainPassword, storedPassword) {
    // التحقق من كلمة السر باستخدام bcrypt
    try {
      return await bcrypt.compare(plainPassword, storedPassword);
    } catch (error) {
      console.error('Error validating password:', error);
      return false;
    }
  }

  // ============ نظام التوصية ============
  static async getUserWatchHistory(userId, limit = 50) {
    try {
      const [rows] = await pool.execute(
        `SELECT wh.*, v.*, u.username as video_username 
         FROM watch_history wh
         JOIN videos v ON wh.video_id = v.id
         JOIN users u ON v.user_id = u.id
         WHERE wh.user_id = ? AND v.deleted_by_admin = FALSE
         ORDER BY wh.updated_at DESC
         LIMIT ?`,
        [userId, limit]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getUserWatchHistory:', error);
      return [];
    }
  }

  static async getUserInteractions(userId, limit = 100) {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM user_interactions 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [userId, limit]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getUserInteractions:', error);
      return [];
    }
  }

  static async getFollowingUsers(userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.username, u.avatar
         FROM followers f
         JOIN users u ON f.following_id = u.id
         WHERE f.follower_id = ? AND u.is_banned = FALSE`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getFollowingUsers:', error);
      return [];
    }
  }

  static async getUserPreferences(userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT up.* 
         FROM user_preferences up
         WHERE user_id = ?`,
        [userId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error in User.getUserPreferences:', error);
      return null;
    }
  }

  static async updateUserPreferences(userId, preferences) {
    try {
      const { preferred_categories, content_weights, excluded_users } = preferences;

      const [result] = await pool.execute(
        `INSERT INTO user_preferences (user_id, preferred_categories, content_weights, excluded_users, updated_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         preferred_categories = VALUES(preferred_categories),
         content_weights = VALUES(content_weights),
         excluded_users = VALUES(excluded_users),
         updated_at = NOW()`,
        [userId, JSON.stringify(preferred_categories), JSON.stringify(content_weights), JSON.stringify(excluded_users)]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.updateUserPreferences:', error);
      throw error;
    }
  }

  // ============ إدارة المستخدمين ============
  static async getAllUsers(page = 1, limit = 10, search = '') {
    try {
      const offset = (page - 1) * limit;
      let query = `
        SELECT id, username, email, avatar, role, is_banned, ban_reason, 
               followers_count, following_count, total_watch_time, created_at, last_login,
               birth_date, birth_day, birth_month, birth_year
        FROM users 
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) as total FROM users WHERE 1=1`;
      const params = [];
      const countParams = [];

      if (search) {
        query += ' AND (username LIKE ? OR email LIKE ?)';
        countQuery += ' AND (username LIKE ? OR email LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
        countParams.push(searchTerm, searchTerm);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [users] = await pool.execute(query, params);
      const [totalResult] = await pool.execute(countQuery, countParams);

      return {
        users,
        total: totalResult[0].total,
        page,
        totalPages: Math.ceil(totalResult[0].total / limit)
      };
    } catch (error) {
      console.error('Error in User.getAllUsers:', error);
      throw error;
    }
  }

  static async updateUser(userId, updateData) {
    try {
      const allowedFields = ['username', 'email', 'role', 'is_banned', 'ban_reason', 'total_watch_time', 'birth_date', 'birth_day', 'birth_month', 'birth_year'];
      const fields = [];
      const values = [];

      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(userId);

      const [result] = await pool.execute(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.updateUser:', error);
      throw error;
    }
  }

  static async banUser(userId, reason = '') {
    try {
      const [result] = await pool.execute(
        'UPDATE users SET is_banned = TRUE, ban_reason = ? WHERE id = ?',
        [reason, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.banUser:', error);
      throw error;
    }
  }

  static async unbanUser(userId) {
    try {
      const [result] = await pool.execute(
        'UPDATE users SET is_banned = FALSE, ban_reason = NULL WHERE id = ?',
        [userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.unbanUser:', error);
      throw error;
    }
  }

  static async deleteUser(userId) {
    try {
      // حذف جميع البيانات المرتبطة بالمستخدم أولاً
      await pool.execute('DELETE FROM likes WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM followers WHERE follower_id = ? OR following_id = ?', [userId, userId]);
      await pool.execute('DELETE FROM messages WHERE sender_id = ?', [userId]);
      await pool.execute('DELETE FROM reports WHERE reporter_id = ? OR reported_user_id = ?', [userId, userId]);
      await pool.execute('DELETE FROM watch_history WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM user_interactions WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM user_preferences WHERE user_id = ?', [userId]);

      // حذف الفيديوهات الخاصة بالمستخدم
      const [videos] = await pool.execute('SELECT id FROM videos WHERE user_id = ?', [userId]);
      for (const video of videos) {
        await pool.execute('DELETE FROM likes WHERE video_id = ?', [video.id]);
        await pool.execute('DELETE FROM reports WHERE video_id = ?', [video.id]);
        await pool.execute('DELETE FROM watch_history WHERE video_id = ?', [video.id]);
      }
      await pool.execute('DELETE FROM videos WHERE user_id = ?', [userId]);

      // أخيراً حذف المستخدم
      const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.deleteUser:', error);
      throw error;
    }
  }

  static async updateProfile(userId, updateData) {
    try {
      const allowedFields = ['username', 'avatar', 'bio', 'social_links', 'birth_date', 'birth_day', 'birth_month', 'birth_year'];
      const fields = [];
      const values = [];

      // Build query dynamically based on provided fields
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });

      if (fields.length === 0) {
        return false; // Nothing to update
      }

      console.log('📝 Updating user profile in database:', {
        userId,
        fields: fields.join(', '),
        values
      });

      values.push(userId);

      const [result] = await pool.execute(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      console.log('✅ Database update result:', {
        affectedRows: result.affectedRows,
        changedRows: result.changedRows
      });

      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error in User.updateProfile:', error);
      throw error;
    }
  }

  static async updateSocialLinks(userId, socialLinks) {
    try {
      const [result] = await pool.execute(
        'UPDATE users SET social_links = ? WHERE id = ?',
        [socialLinks, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.updateSocialLinks:', error);
      throw error;
    }
  }

  static async updatePreferences(userId, preferences) {
    try {
      const { language, theme } = preferences;
      const [result] = await pool.execute(
        'UPDATE users SET language = ?, theme = ? WHERE id = ?',
        [language, theme, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.updatePreferences:', error);
      throw error;
    }
  }

  static async updatePassword(userId, newPassword) {
    try {
      // 🔥 تحديث بكلمة سر مشفرة
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      const [result] = await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.updatePassword:', error);
      throw error;
    }
  }

  static async setEmailVerified(userId) {
    try {
      const [result] = await pool.execute(
        'UPDATE users SET email_verified = TRUE WHERE id = ?',
        [userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.setEmailVerified:', error);
      throw error;
    }
  }

  static async deleteAccount(userId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.deleteAccount:', error);
      throw error;
    }
  }

  // ============ المتابعة ============
  static async followUser(followerId, followingId) {
    try {
      await pool.execute(
        'INSERT INTO followers (follower_id, following_id) VALUES (?, ?)',
        [followerId, followingId]
      );

      await pool.execute(
        'UPDATE users SET followers_count = followers_count + 1 WHERE id = ?',
        [followingId]
      );
      await pool.execute(
        'UPDATE users SET following_count = following_count + 1 WHERE id = ?',
        [followerId]
      );

      return true;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return false;
      }
      console.error('Error in User.followUser:', error);
      throw error;
    }
  }

  static async unfollowUser(followerId, followingId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM followers WHERE follower_id = ? AND following_id = ?',
        [followerId, followingId]
      );

      if (result.affectedRows > 0) {
        await pool.execute(
          'UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = ?',
          [followingId]
        );
        await pool.execute(
          'UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = ?',
          [followerId]
        );
      }

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.unfollowUser:', error);
      throw error;
    }
  }

  static async isFollowing(followerId, followingId) {
    try {
      const [rows] = await pool.execute(
        'SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?',
        [followerId, followingId]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Error in User.isFollowing:', error);
      return false;
    }
  }

  // ============ البحث والاستكشاف ============
  static async searchUsers(query, userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT id, username, avatar, bio, followers_count, following_count, total_watch_time, birth_date
         FROM users 
         WHERE username LIKE ? AND id != ? AND is_banned = FALSE
         ORDER BY followers_count DESC 
         LIMIT 20`,
        [`%${query}%`, userId]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.searchUsers:', error);
      return [];
    }
  }

  static async getUserFollowers(userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.username, u.avatar, u.bio, u.birth_date
         FROM followers f 
         JOIN users u ON f.follower_id = u.id 
         WHERE f.following_id = ? AND u.is_banned = FALSE
         ORDER BY f.created_at DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getUserFollowers:', error);
      return [];
    }
  }

  static async getUserFollowing(userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.username, u.avatar, u.bio, u.birth_date
         FROM followers f 
         JOIN users u ON f.following_id = u.id 
         WHERE f.follower_id = ? AND u.is_banned = FALSE
         ORDER BY f.created_at DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getUserFollowing:', error);
      return [];
    }
  }

  static async getLikedVideos(userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT v.*, u.username,
                (SELECT COUNT(*) FROM likes WHERE video_id = v.id) as likes,
                TRUE as is_liked
         FROM videos v
         JOIN likes l ON v.id = l.video_id
         JOIN users u ON v.user_id = u.id
         WHERE l.user_id = ? AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE
         ORDER BY l.created_at DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getLikedVideos:', error);
      return [];
    }
  }

  // ============ الإحصائيات ============
  static async updateUserStats(userId) {
    try {
      await pool.execute(
        `UPDATE users 
         SET 
           likes_count = (SELECT COUNT(*) FROM likes WHERE user_id = ?),
           views_count = (SELECT COALESCE(SUM(views), 0) FROM videos WHERE user_id = ? AND deleted_by_admin = FALSE),
           total_watch_time = (SELECT COALESCE(SUM(watch_time), 0) FROM watch_history WHERE user_id = ?)
         WHERE id = ?`,
        [userId, userId, userId, userId]
      );
    } catch (error) {
      console.error('Error in User.updateUserStats:', error);
      throw error;
    }
  }

  // ============ أدوات مساعدة ============
  static async getUserStats(userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT 
           followers_count,
           following_count,
           likes_count,
           views_count,
           total_watch_time,
           (SELECT COUNT(*) FROM videos WHERE user_id = ? AND deleted_by_admin = FALSE) as videos_count
         FROM users 
         WHERE id = ?`,
        [userId, userId]
      );
      return rows[0];
    } catch (error) {
      console.error('Error in User.getUserStats:', error);
      return null;
    }
  }

  static async updateLastLogin(userId) {
    try {
      await pool.execute(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [userId]
      );
    } catch (error) {
      console.error('Error in User.updateLastLogin:', error);
    }
  }

  static async getTopUsersByWatchTime(limit = 10) {
    try {
      const [rows] = await pool.execute(
        `SELECT id, username, avatar, total_watch_time, followers_count, birth_date
         FROM users 
         WHERE is_banned = FALSE
         ORDER BY total_watch_time DESC 
         LIMIT ?`,
        [limit]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getTopUsersByWatchTime:', error);
      return [];
    }
  }

  static async getUserWatchSessions(userId, videoId = null) {
    try {
      let query = `
        SELECT uws.*, v.title as video_title, v.url as video_url
        FROM user_watch_sessions uws
        LEFT JOIN videos v ON uws.video_id = v.id
        WHERE uws.user_id = ?
      `;
      const params = [userId];

      if (videoId) {
        query += ' AND uws.video_id = ?';
        params.push(videoId);
      }

      query += ' ORDER BY uws.last_activity DESC';

      const [sessions] = await pool.execute(query, params);
      return sessions;
    } catch (error) {
      console.error('Error in User.getUserWatchSessions:', error);
      return [];
    }
  }

  static async resetUserWatchTime(userId, videoId = null) {
    try {
      if (videoId) {
        await pool.execute(
          'DELETE FROM user_watch_sessions WHERE user_id = ? AND video_id = ?',
          [userId, videoId]
        );
      } else {
        await pool.execute(
          'DELETE FROM user_watch_sessions WHERE user_id = ?',
          [userId]
        );
      }
      return true;
    } catch (error) {
      console.error('Error in User.resetUserWatchTime:', error);
      throw error;
    }
  }

  static async getTotalWatchTimeToday(userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT COALESCE(SUM(total_watch_time), 0) as total_today
         FROM user_watch_sessions 
         WHERE user_id = ? AND DATE(last_activity) = CURDATE()`,
        [userId]
      );
      return rows[0].total_today;
    } catch (error) {
      console.error('Error in User.getTotalWatchTimeToday:', error);
      return 0;
    }
  }

  // ============ دوال إضافية لتاريخ الميلاد ============
  static async getUsersByBirthMonth(month) {
    try {
      const [rows] = await pool.execute(
        'SELECT id, username, avatar, birth_date, birth_day, birth_month, birth_year FROM users WHERE birth_month = ? AND is_banned = FALSE',
        [month]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getUsersByBirthMonth:', error);
      return [];
    }
  }

  static async getUsersByBirthYear(year) {
    try {
      const [rows] = await pool.execute(
        'SELECT id, username, avatar, birth_date, birth_day, birth_month, birth_year FROM users WHERE birth_year = ? AND is_banned = FALSE',
        [year]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getUsersByBirthYear:', error);
      return [];
    }
  }

  static async calculateAge(userId) {
    try {
      const user = await this.findById(userId);
      if (!user || !user.birth_date) {
        return null;
      }

      const birthDate = new Date(user.birth_date);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return age;
    } catch (error) {
      console.error('Error in User.calculateAge:', error);
      return null;
    }
  }

  static async getUpcomingBirthdays(days = 30) {
    try {
      const [rows] = await pool.execute(
        `SELECT id, username, avatar, birth_date, birth_day, birth_month, birth_year
         FROM users 
         WHERE is_banned = FALSE 
         AND birth_date IS NOT NULL
         AND DATE_FORMAT(birth_date, '%m-%d') BETWEEN DATE_FORMAT(NOW(), '%m-%d') 
         AND DATE_FORMAT(DATE_ADD(NOW(), INTERVAL ? DAY), '%m-%d')
         ORDER BY DATE_FORMAT(birth_date, '%m-%d') ASC`,
        [days]
      );
      return rows;
    } catch (error) {
      console.error('Error in User.getUpcomingBirthdays:', error);
      return [];
    }
  }

  static async updatePrivacySettings(userId, settings) {
    try {
      const { is_private, allow_dms, show_activity_status } = settings;
      const [result] = await pool.execute(
        'UPDATE users SET is_private = ?, allow_dms = ?, show_activity_status = ? WHERE id = ?',
        [is_private, allow_dms, show_activity_status, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in User.updatePrivacySettings:', error);
      throw error;
    }
  }
}
