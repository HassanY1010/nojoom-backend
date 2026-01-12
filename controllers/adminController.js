import { pool } from '../config/db.js';

const adminController = {
  // إدارة المستخدمين
  async getUsers(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT id, username, email, avatar, role, is_banned, ban_reason, 
               created_at, last_seen, is_online, followers_count, following_count,
               total_watch_time
        FROM users 
        WHERE 1=1
      `;
      let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
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
      params.push(parseInt(limit), offset);

      const [users] = await pool.execute(query, params);
      const [totalResult] = await pool.execute(countQuery, countParams);

      res.json({
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getUser(req, res) {
    try {
      const { id } = req.params;

      const [users] = await pool.execute(
        `SELECT id, username, email, avatar, role, is_banned, ban_reason,
                created_at, last_seen, is_online, followers_count, following_count,
                total_watch_time, bio, social_links
         FROM users 
         WHERE id = ?`,
        [id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // الحصول على إحصائيات إضافية
      const [videoCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM videos WHERE user_id = ? AND deleted_by_admin = FALSE',
        [id]
      );

      const [reportsCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM reports WHERE reported_user_id = ?',
        [id]
      );

      res.json({
        user: users[0],
        stats: {
          videos: videoCount[0].count,
          reports: reportsCount[0].count
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      let { username, email, role, is_banned, ban_reason } = req.body;

      // التحقق من أن المستخدم لا يقوم بتعديل نفسه
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot update your own account' });
      }

      // تحويل undefined إلى null
      username = username ?? null;
      email = email ?? null;
      role = role ?? null;
      is_banned = is_banned ?? null;
      ban_reason = ban_reason ?? null;

      const [result] = await pool.execute(
        `UPDATE users 
       SET username = COALESCE(?, username),
           email = COALESCE(?, email),
           role = COALESCE(?, role),
           is_banned = COALESCE(?, is_banned),
           ban_reason = COALESCE(?, ban_reason),
           updated_at = NOW()
       WHERE id = ?`,
        [username, email, role, is_banned, ban_reason, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async banUser(req, res) {
    try {
      const { id } = req.params;
      const { reason = 'Violation of terms of service' } = req.body;

      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot ban yourself' });
      }

      const [result] = await pool.execute(
        'UPDATE users SET is_banned = TRUE, ban_reason = ? WHERE id = ?',
        [reason, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User banned successfully', reason });
    } catch (error) {
      console.error('Ban user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async unbanUser(req, res) {
    try {
      const { id } = req.params;

      const [result] = await pool.execute(
        'UPDATE users SET is_banned = FALSE, ban_reason = NULL WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User unbanned successfully' });
    } catch (error) {
      console.error('Unban user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // إدارة الفيديوهات
  async getVideos(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const offset = (page - 1) * limit;

      const params = [];
      const countParams = [];

      let query = `
      SELECT v.*, u.username, u.email, u.avatar,
             (SELECT COUNT(*) FROM likes WHERE video_id = v.id) as likes_count,
             (SELECT COUNT(*) FROM reports WHERE video_id = v.id AND status = 'pending') as pending_reports_count
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.deleted_by_admin = FALSE
    `;

      let countQuery = `
      SELECT COUNT(*) as total 
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.deleted_by_admin = FALSE
    `;

      if (search) {
        const searchTerm = `%${search}%`;
        query += ' AND (v.description LIKE ? OR u.username LIKE ?)';
        countQuery += ' AND (v.description LIKE ? OR u.username LIKE ?)';
        params.push(searchTerm, searchTerm);
        countParams.push(searchTerm, searchTerm);
      }

      query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const [videos] = await pool.execute(query, params);
      const [totalResult] = await pool.execute(countQuery, countParams);

      res.json({
        videos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getVideo(req, res) {
    try {
      const { id } = req.params;

      const [videos] = await pool.execute(
        `SELECT v.*, u.username, u.email, u.avatar, u.is_banned,
                (SELECT COUNT(*) FROM likes WHERE video_id = v.id) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE video_id = v.id AND deleted_by_admin = FALSE) as comments_count,
                (SELECT COUNT(*) FROM reports WHERE video_id = v.id) as reports_count
         FROM videos v
         JOIN users u ON v.user_id = u.id
         WHERE v.id = ?`,
        [id]
      );

      if (videos.length === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({ video: videos[0] });
    } catch (error) {
      console.error('Get video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteVideoAdmin(req, res) {
    try {
      const { id } = req.params;
      const { reason = 'Violation of terms of service' } = req.body;

      const [result] = await pool.execute(
        'UPDATE videos SET deleted_by_admin = TRUE, deletion_reason = ?, deleted_at = NOW() WHERE id = ?',
        [reason, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // حذف جميع البلاغات المرتبطة بهذا الفيديو
      await pool.execute('DELETE FROM reports WHERE video_id = ?', [id]);

      res.json({ message: 'Video deleted successfully', reason });
    } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async pinVideo(req, res) {
    try {
      const { id } = req.params;

      const [result] = await pool.execute(
        'UPDATE videos SET is_pinned = TRUE, pinned_at = NOW() WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({ message: 'Video pinned successfully' });
    } catch (error) {
      console.error('Pin video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async unpinVideo(req, res) {
    try {
      const { id } = req.params;

      const [result] = await pool.execute(
        'UPDATE videos SET is_pinned = FALSE, pinned_at = NULL WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({ message: 'Video unpinned successfully' });
    } catch (error) {
      console.error('Unpin video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getPinnedVideos(req, res) {
    try {
      const [videos] = await pool.execute(
        `SELECT v.*, u.username, u.avatar 
         FROM videos v 
         JOIN users u ON v.user_id = u.id 
         WHERE v.is_pinned = TRUE AND v.deleted_by_admin = FALSE
         ORDER BY v.pinned_at DESC`
      );

      res.json({ videos });
    } catch (error) {
      console.error('Get pinned videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getMostViewedVideos(req, res) {
    try {
      const { limit = 10 } = req.query;

      const [videos] = await pool.execute(
        `SELECT v.*, u.username, u.avatar 
         FROM videos v 
         JOIN users u ON v.user_id = u.id 
         WHERE v.deleted_by_admin = FALSE
         ORDER BY v.views DESC 
         LIMIT ?`,
        [parseInt(limit)]
      );

      res.json({ videos });
    } catch (error) {
      console.error('Get most viewed videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // البث والإحصائيات
  async sendBroadcast(req, res) {
    try {
      const { content, target = 'all' } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({
          error: 'Broadcast content is required'
        });
      }

      if (content.length > 500) {
        return res.status(400).json({
          error: 'Broadcast content too long (max 500 characters)'
        });
      }

      // حفظ البث في قاعدة البيانات
      const [result] = await pool.execute(
        'INSERT INTO broadcasts (admin_id, content, target, created_at) VALUES (?, ?, ?, NOW())',
        [req.user.id, content.trim(), target]
      );

      const broadcast = {
        id: result.insertId,
        content: content.trim(),
        type: 'admin',
        target: target,
        created_at: new Date(),
        admin_username: req.user.username
      };

      res.status(201).json({
        message: 'Broadcast sent successfully',
        broadcast: broadcast
      });

    } catch (error) {
      console.error('Broadcast error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getBroadcasts(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const [broadcasts] = await pool.execute(
        `SELECT b.*, u.username as admin_username, u.avatar as admin_avatar
         FROM broadcasts b 
         LEFT JOIN users u ON b.admin_id = u.id 
         ORDER BY b.created_at DESC 
         LIMIT ? OFFSET ?`,
        [parseInt(limit), offset]
      );

      const [totalResult] = await pool.execute('SELECT COUNT(*) as total FROM broadcasts');

      res.json({
        broadcasts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get broadcasts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getStats(req, res) {
    try {
      const [
        usersStats,
        videosStats,
        messagesStats,
        reportsStats,
        storageStats
      ] = await Promise.all([
        pool.execute(`
          SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN is_online = TRUE THEN 1 END) as active_users,
            COUNT(CASE WHEN is_banned = TRUE THEN 1 END) as banned_users,
            COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_users
          FROM users
        `),
        pool.execute(`
          SELECT 
            COUNT(*) as total_videos,
            COUNT(CASE WHEN is_pinned = TRUE THEN 1 END) as pinned_videos,
            COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as daily_uploads,
            COALESCE(SUM(views), 0) as total_views,
            COALESCE(SUM(likes), 0) as total_likes
          FROM videos 
          WHERE deleted_by_admin = FALSE
        `),
        pool.execute(`
          SELECT 
            COUNT(*) as total_messages
          FROM messages
        `),
        pool.execute(`
          SELECT 
            COUNT(*) as total_reports,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
            COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_reports,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_reports,
            COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_reports
          FROM reports
        `),
        pool.execute(`
          SELECT COALESCE(SUM(LENGTH(path)), 0) as storage_used
          FROM videos
          WHERE deleted_by_admin = FALSE
        `)
      ]);

      const users = usersStats[0][0];
      const videos = videosStats[0][0];
      const messages = messagesStats[0][0];
      const reports = reportsStats[0][0];
      const storage = storageStats[0][0];

      res.json({
        stats: {
          totalUsers: users.total_users || 0,
          totalVideos: videos.total_videos || 0,
          totalMessages: messages.total_messages || 0,
          activeUsers: users.active_users || 0,
          storageUsed: storage.storage_used || 0,
          dailyUploads: videos.daily_uploads || 0,
          serverLoad: 0, // Placeholder - would need system monitoring
          responseTime: 0, // Placeholder - would need performance monitoring
          pendingReports: reports.pending_reports || 0,
          totalReports: reports.total_reports || 0,
          bannedUsers: users.banned_users || 0,
          pinnedVideos: videos.pinned_videos || 0,
          totalViews: parseInt(videos.total_views) || 0,
          totalLikes: parseInt(videos.total_likes) || 0,
          todayUsers: users.today_users || 0,
          todayReports: reports.today_reports || 0,
          resolvedReports: reports.resolved_reports || 0,
          rejectedReports: reports.rejected_reports || 0
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // التحكم في النظام
  async getSystemSettings(req, res) {
    try {
      const [settings] = await pool.execute(
        'SELECT * FROM system_settings WHERE id = 1'
      );

      if (settings.length === 0) {
        // إعدادات افتراضية
        const defaultSettings = {
          maintenance_mode: false,
          chat_enabled: true,
          upload_enabled: true,
          user_registration_enabled: true,
          max_video_size: 104857600, // 100 MB
          max_video_duration: 300,
          auto_ban_reports_threshold: 5,
          allowed_video_formats: 'mp4,mov,avi'
        };
        return res.json({ settings: defaultSettings });
      }

      res.json({ settings: settings[0] });
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateSystemSettings(req, res) {
    try {
      // دعم الاستلام المباشر أو داخل كائن settings
      const data = req.body.settings || req.body;

      let {
        maintenance_mode,
        chat_enabled,
        upload_enabled,
        user_registration_enabled,
        max_video_size,
        max_video_duration,
        auto_ban_reports_threshold,
        allowed_video_formats
      } = data;

      const [result] = await pool.execute(
        `INSERT INTO system_settings 
       (id, maintenance_mode, chat_enabled, upload_enabled, user_registration_enabled, max_video_size, max_video_duration, auto_ban_reports_threshold, allowed_video_formats, updated_at) 
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
       maintenance_mode = COALESCE(VALUES(maintenance_mode), maintenance_mode),
       chat_enabled = COALESCE(VALUES(chat_enabled), chat_enabled),
       upload_enabled = COALESCE(VALUES(upload_enabled), upload_enabled),
       user_registration_enabled = COALESCE(VALUES(user_registration_enabled), user_registration_enabled),
       max_video_size = COALESCE(VALUES(max_video_size), max_video_size),
       max_video_duration = COALESCE(VALUES(max_video_duration), max_video_duration),
       auto_ban_reports_threshold = COALESCE(VALUES(auto_ban_reports_threshold), auto_ban_reports_threshold),
       allowed_video_formats = COALESCE(VALUES(allowed_video_formats), allowed_video_formats),
       updated_at = NOW()`,
        [
          maintenance_mode ?? null,
          chat_enabled ?? null,
          upload_enabled ?? null,
          user_registration_enabled ?? null,
          max_video_size ?? null,
          max_video_duration ?? null,
          auto_ban_reports_threshold ?? null,
          allowed_video_formats ?? null
        ]
      );

      res.json({ message: 'System settings updated successfully' });
    } catch (error) {
      console.error('Update system settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  // دوال الدردشة والإحصائيات (مطلوبة في الـ routes)
  async getChatStats(req, res) {
    try {
      const { period = '24h' } = req.query;

      let timeFilter = '1 HOUR';
      if (period === '7d') timeFilter = '7 DAY';
      if (period === '30d') timeFilter = '30 DAY';

      const [
        activeChatsResult,
        messagesResult,
        activeUsersResult
      ] = await Promise.all([
        pool.execute(
          `SELECT COUNT(DISTINCT video_id) as count 
           FROM messages 
           WHERE created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})`
        ),
        pool.execute(
          `SELECT COUNT(*) as count 
           FROM messages 
           WHERE created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})`
        ),
        pool.execute(
          `SELECT COUNT(DISTINCT sender_id) as count 
           FROM messages 
           WHERE created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})`
        )
      ]);

      res.json({
        period: period,
        stats: {
          activeChats: activeChatsResult[0][0].count,
          totalMessages: messagesResult[0][0].count,
          activeUsers: activeUsersResult[0][0].count
        }
      });
    } catch (error) {
      console.error('Get chat stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getMessages(req, res) {
    try {
      const { page = 1, limit = 50, videoId } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT m.*, u.username, u.avatar, u.role as user_role
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (videoId) {
        query += ' AND m.video_id = ?';
        params.push(videoId);
      }

      query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const [messages] = await pool.execute(query, params);

      const [totalResult] = await pool.execute(
        'SELECT COUNT(*) as total FROM messages WHERE 1=1' + (videoId ? ' AND video_id = ?' : ''),
        videoId ? [videoId] : []
      );

      res.json({
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { reason = 'Administrative action' } = req.body;

      const [messages] = await pool.execute(
        'SELECT * FROM messages WHERE id = ?',
        [messageId]
      );

      if (messages.length === 0) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const message = messages[0];

      // حفظ نسخة في السجل
      await pool.execute(
        `INSERT INTO deleted_messages 
         (original_id, sender_id, video_id, content, type, created_at, deleted_by, reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [message.id, message.sender_id, message.video_id, message.content,
        message.type, message.created_at, req.user.id, reason]
      );

      // حذف الرسالة الأصلية
      await pool.execute('DELETE FROM messages WHERE id = ?', [messageId]);

      res.json({
        message: 'Message deleted successfully',
        details: {
          messageId: messageId,
          content: message.content,
          senderId: message.sender_id
        }
      });

    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default adminController;