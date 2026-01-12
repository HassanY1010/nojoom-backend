import { pool } from '../config/db.js';

export class Message {
  // إنشاء رسالة جديدة مع نظام التدوير
  static async create(messageData) {
    const { sender_id, video_id, content, type = 'user' } = messageData;

    const [result] = await pool.execute(
      'INSERT INTO messages (sender_id, video_id, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
      [sender_id, video_id, content, type]
    );

    // إرجاع بيانات الرسالة الكاملة
    const [messages] = await pool.execute(
      `SELECT m.*, u.username, u.avatar, u.role
       FROM messages m 
       LEFT JOIN users u ON m.sender_id = u.id 
       WHERE m.id = ?`,
      [result.insertId]
    );

    return messages[0];
  }

  // الحصول على رسائل الفيديو مع نظام التدوير
  static async getByVideoId(videoId, limit = 100, offset = 0) {
    const [rows] = await pool.execute(
      `SELECT m.*, u.username, u.avatar, u.role,
              (SELECT COUNT(*) FROM message_displays WHERE message_id = m.id) as display_count
       FROM messages m 
       LEFT JOIN users u ON m.sender_id = u.id 
       WHERE m.video_id = ? AND u.is_banned = FALSE
       ORDER BY m.created_at DESC 
       LIMIT ? OFFSET ?`,
      [videoId, limit, offset]
    );
    return rows;
  }

  // إنشاء رسالة مباشرة جديدة مع تحديث المحادثة النشطة
  static async createDirectMessage(messageData) {
    const { sender_id, receiver_id, content } = messageData;

    // إدخال الرسالة الجديدة
    const [result] = await pool.execute(
      'INSERT INTO direct_messages (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, NOW())',
      [sender_id, receiver_id, content]
    );

    // تحديث المحادثة النشطة
    await this.updateActiveConversation(sender_id, receiver_id, result.insertId, content);

    return result.insertId;
  }

  // تحديث المحادثة النشطة
  static async updateActiveConversation(user1_id, user2_id, last_message_id, last_message_content) {
    // ترتيب المعرفات لتجنب الازدواجية
    const [user1, user2] = [user1_id, user2_id].sort((a, b) => a - b);

    await pool.execute(
      `INSERT INTO active_conversations 
       (user1_id, user2_id, last_message_id, last_message_content, last_message_at) 
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
         last_message_id = VALUES(last_message_id),
         last_message_content = VALUES(last_message_content),
         last_message_at = VALUES(last_message_at)`,
      [user1, user2, last_message_id, last_message_content]
    );
  }

  // الحصول على محادثة بين مستخدمين
  static async getConversation(userId1, userId2, limit = 100, offset = 0) {
    const [rows] = await pool.execute(
      `SELECT dm.*, 
              u1.username as sender_username, u1.avatar as sender_avatar,
              u2.username as receiver_username, u2.avatar as receiver_avatar
       FROM direct_messages dm
       JOIN users u1 ON dm.sender_id = u1.id
       JOIN users u2 ON dm.receiver_id = u2.id
       WHERE (dm.sender_id = ? AND dm.receiver_id = ?) 
          OR (dm.sender_id = ? AND dm.receiver_id = ?)
       ORDER BY dm.created_at ASC
       LIMIT ? OFFSET ?`,
      [userId1, userId2, userId2, userId1, limit, offset]
    );
    return rows;
  }

  // الحصول على محادثات المستخدم
  static async getUserConversations(userId) {
    const [rows] = await pool.execute(
      `SELECT 
          u.id,
          u.username,
          u.avatar,
          u.is_online,
          ac.last_message_content,
          ac.last_message_at,
          (SELECT COUNT(*) FROM direct_messages 
           WHERE sender_id = u.id AND receiver_id = ? AND is_read = FALSE) as unread_count,
          u.id as other_user_id
       FROM active_conversations ac
       JOIN users u ON (u.id = CASE 
                              WHEN ac.user1_id = ? THEN ac.user2_id
                              ELSE ac.user1_id
                            END)
       WHERE (ac.user1_id = ? OR ac.user2_id = ?)
         AND u.is_banned = FALSE
       ORDER BY ac.last_message_at DESC`,
      [userId, userId, userId, userId]
    );
    return rows;
  }

  // الحصول على عدد الرسائل غير المقروءة
  static async getUnreadCount(userId) {
    const [result] = await pool.execute(
      'SELECT COUNT(*) as unread_count FROM direct_messages WHERE receiver_id = ? AND is_read = FALSE',
      [userId]
    );
    return result[0].unread_count;
  }

  // تحديد الرسائل كمقروءة
  static async markAsRead(senderId, receiverId) {
    const [result] = await pool.execute(
      'UPDATE direct_messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE',
      [senderId, receiverId]
    );

    return result.affectedRows;
  }

  // تتبع عرض الرسالة (لنظام التدوير)
  static async trackMessageDisplay(messageId, userId) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO message_displays (message_id, user_id, displayed_at) 
         VALUES (?, ?, NOW()) 
         ON DUPLICATE KEY UPDATE display_count = display_count + 1, displayed_at = NOW()`,
        [messageId, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Track message display error:', error);
      return false;
    }
  }

  // الحصول على عدد مرات عرض الرسالة
  static async getMessageDisplayCount(messageId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM message_displays WHERE message_id = ?',
      [messageId]
    );
    return rows[0].count;
  }

  // الحصول على الرسائل التي تحتاج إلى إعادة عرض (نظام التدوير)
  static async getMessagesForRotation(videoId, userId, limit = 20) {
    const [rows] = await pool.execute(
      `SELECT m.*, u.username, u.avatar, u.role,
              COALESCE(md.display_count, 0) as user_display_count
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN message_displays md ON m.id = md.message_id AND md.user_id = ?
       WHERE m.video_id = ? 
         AND u.is_banned = FALSE
         AND (md.display_count IS NULL OR md.display_count < 4)
       ORDER BY RAND() 
       LIMIT ?`,
      [userId, videoId, limit]
    );
    return rows;
  }

  // البث الإداري مع نظام التدوير
  static async createBroadcast(adminId, content, target = 'all') {
    const [result] = await pool.execute(
      'INSERT INTO broadcasts (admin_id, content, target, created_at) VALUES (?, ?, ?, NOW())',
      [adminId, content, target]
    );

    return {
      id: result.insertId,
      content: content,
      type: 'admin',
      target: target,
      created_at: new Date(),
      admin_id: adminId,
      display_count: 0
    };
  }

  // الحصول على البث الإداري مع الإحصائيات
  static async getBroadcasts(limit = 50, offset = 0, filters = {}) {
    let query = `
      SELECT b.*, u.username as admin_username, u.avatar as admin_avatar,
             (SELECT COUNT(*) FROM broadcast_displays WHERE broadcast_id = b.id) as total_displays,
             (SELECT COUNT(DISTINCT user_id) FROM broadcast_displays WHERE broadcast_id = b.id) as unique_viewers
      FROM broadcasts b
      LEFT JOIN users u ON b.admin_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.admin_id) {
      query += ' AND b.admin_id = ?';
      params.push(filters.admin_id);
    }

    if (filters.start_date) {
      query += ' AND DATE(b.created_at) >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ' AND DATE(b.created_at) <= ?';
      params.push(filters.end_date);
    }

    if (filters.search) {
      query += ' AND b.content LIKE ?';
      params.push(`%${filters.search}%`);
    }

    query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // تتبع عرض البث الإداري
  static async trackBroadcastDisplay(broadcastId, userId) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO broadcast_displays (broadcast_id, user_id, displayed_at) 
         VALUES (?, ?, NOW()) 
         ON DUPLICATE KEY UPDATE display_count = display_count + 1, displayed_at = NOW()`,
        [broadcastId, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Track broadcast display error:', error);
      return false;
    }
  }

  // الحصول على رسالة مع التفاصيل
  static async getMessageWithDetails(messageId) {
    const [rows] = await pool.execute(
      `SELECT m.*, 
              u.username, u.avatar, u.role,
              v.title as video_title, v.owner_id as video_owner_id,
              u2.username as video_owner_username,
              (SELECT COUNT(*) FROM message_displays WHERE message_id = m.id) as total_displays,
              (SELECT COUNT(DISTINCT user_id) FROM message_displays WHERE message_id = m.id) as unique_viewers
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN videos v ON m.video_id = v.id
       LEFT JOIN users u2 ON v.owner_id = u2.id
       WHERE m.id = ?`,
      [messageId]
    );
    return rows[0];
  }

  // البحث في الرسائل
  static async searchMessages(userId, query, limit = 50) {
    const [rows] = await pool.execute(
      `SELECT dm.*,
              u1.username as sender_username, u1.avatar as sender_avatar,
              u2.username as receiver_username, u2.avatar as receiver_avatar
       FROM direct_messages dm
       JOIN users u1 ON dm.sender_id = u1.id
       JOIN users u2 ON dm.receiver_id = u2.id
       WHERE (dm.sender_id = ? OR dm.receiver_id = ?)
         AND dm.content LIKE ?
       ORDER BY dm.created_at DESC
       LIMIT ?`,
      [userId, userId, `%${query}%`, limit]
    );
    return rows;
  }

  // حذف محادثة
  static async deleteConversation(userId1, userId2) {
    const [result] = await pool.execute(
      'DELETE FROM direct_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [userId1, userId2, userId2, userId1]
    );

    // حذف المحادثة النشطة
    await pool.execute(
      'DELETE FROM active_conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
      [userId1, userId2, userId2, userId1].sort((a, b) => a - b)
    );

    return result.affectedRows;
  }

  // الحصول على إحصائيات الرسائل
  static async getMessageStats(userId) {
    const [stats] = await pool.execute(
      `SELECT 
          COUNT(*) as total_messages,
          SUM(CASE WHEN receiver_id = ? AND is_read = FALSE THEN 1 ELSE 0 END) as unread_messages,
          COUNT(DISTINCT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END) as total_conversations
       FROM direct_messages 
       WHERE sender_id = ? OR receiver_id = ?`,
      [userId, userId, userId, userId]
    );

    return stats[0];
  }

  // إحصائيات الرسائل المتقدمة
  static async getMessageStatsAdvanced(period = '24h') {
    let timeFilter = '1 HOUR';
    if (period === '7d') timeFilter = '7 DAY';
    if (period === '30d') timeFilter = '30 DAY';

    const [
      totalResult,
      todayResult,
      periodResult,
      activeChatsResult,
      topChattersResult,
      emojiStatsResult
    ] = await Promise.all([
      pool.execute('SELECT COUNT(*) as total FROM messages'),
      pool.execute('SELECT COUNT(*) as today FROM messages WHERE DATE(created_at) = CURDATE()'),
      pool.execute(`SELECT COUNT(*) as period FROM messages WHERE created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})`),
      pool.execute(`SELECT COUNT(DISTINCT video_id) as active_chats FROM messages WHERE created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})`),
      pool.execute(`
        SELECT u.username, u.avatar, COUNT(m.id) as message_count
        FROM users u
        JOIN messages m ON u.id = m.sender_id
        WHERE m.created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})
        GROUP BY u.id, u.username, u.avatar
        ORDER BY message_count DESC
        LIMIT 10
      `),
      pool.execute(`
        SELECT 
          SUBSTRING_INDEX(SUBSTRING_INDEX(content, ' ', numbers.n), ' ', -1) as emoji,
          COUNT(*) as count
        FROM messages
        JOIN (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) numbers
          ON CHAR_LENGTH(content) - CHAR_LENGTH(REPLACE(content, ' ', '')) >= numbers.n - 1
        WHERE content REGEXP '[\\x{1F600}-\\x{1F64F}]|[\\x{1F300}-\\x{1F5FF}]|[\\x{1F680}-\\x{1F6FF}]|[\\x{1F1E0}-\\x{1F1FF}]'
          AND created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})
        GROUP BY emoji
        ORDER BY count DESC
        LIMIT 10
      `)
    ]);

    return {
      period: period,
      stats: {
        total: totalResult[0][0].total,
        today: todayResult[0][0].today,
        period: periodResult[0][0].period,
        activeChats: activeChatsResult[0][0].active_chats,
        topChatters: topChattersResult[0],
        popularEmojis: emojiStatsResult[0],
        avgMessagesPerChat: (periodResult[0][0].period / activeChatsResult[0][0].active_chats).toFixed(1)
      },
      timestamp: new Date().toISOString()
    };
  }

  // الحصول على المحادثات النشطة
  static async getActiveChats(hours = 24, limit = 20) {
    const [rows] = await pool.execute(
      `SELECT 
          v.id as video_id,
          v.title as video_title,
          v.owner_id,
          u.username as owner_username,
          COUNT(m.id) as message_count,
          COUNT(DISTINCT m.sender_id) as unique_chatters,
          MAX(m.created_at) as last_activity,
          (SELECT content FROM messages WHERE video_id = v.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM videos v
       JOIN messages m ON v.id = m.video_id
       JOIN users u ON v.owner_id = u.id
       WHERE m.created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
         AND v.deleted_by_admin = FALSE
       GROUP BY v.id, v.title, v.owner_id, u.username
       ORDER BY message_count DESC
       LIMIT ?`,
      [hours, limit]
    );
    return rows;
  }

  // البحث المتقدم في الرسائل
  static async searchMessagesAdvanced(filters = {}, limit = 50, offset = 0) {
    let query = `
      SELECT m.*, u.username, u.avatar, u.role, v.title as video_title
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN videos v ON m.video_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.video_id) {
      query += ' AND m.video_id = ?';
      params.push(filters.video_id);
    }

    if (filters.sender_id) {
      query += ' AND m.sender_id = ?';
      params.push(filters.sender_id);
    }

    if (filters.type) {
      query += ' AND m.type = ?';
      params.push(filters.type);
    }

    if (filters.start_date) {
      query += ' AND DATE(m.created_at) >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ' AND DATE(m.created_at) <= ?';
      params.push(filters.end_date);
    }

    if (filters.content) {
      query += ' AND m.content LIKE ?';
      params.push(`%${filters.content}%`);
    }

    if (filters.username) {
      query += ' AND u.username LIKE ?';
      params.push(`%${filters.username}%`);
    }

    query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // تنظيف الرسائل القديمة
  static async cleanupOldMessages(days = 30) {
    const [result] = await pool.execute(
      'DELETE FROM direct_messages WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );

    // تنظيف المحادثات النشطة التي لا تحتوي على رسائل
    await pool.execute(
      `DELETE FROM active_conversations 
       WHERE last_message_id NOT IN (SELECT id FROM direct_messages)`
    );

    return result.affectedRows;
  }

  // تنظيف الرسائل القديمة مع السجل
  static async cleanupOldMessagesWithArchive(days = 30, batchSize = 1000) {
    try {
      // حفظ الرسائل المحذوفة في السجل أولاً
      await pool.execute(
        `INSERT INTO deleted_messages_archive 
         (original_id, sender_id, video_id, content, type, created_at, deleted_at)
         SELECT id, sender_id, video_id, content, type, created_at, NOW()
         FROM messages 
         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY) 
         AND type = 'user'
         LIMIT ?`,
        [days, batchSize]
      );

      // ثم حذف الرسائل الأصلية
      const [result] = await pool.execute(
        'DELETE FROM messages WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY) AND type = "user" LIMIT ?',
        [days, batchSize]
      );

      return {
        deleted: result.affectedRows,
        batchSize: batchSize,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Cleanup old messages error:', error);
      throw error;
    }
  }

  // إحصائيات استخدام النظام
  static async getSystemUsageStats(days = 7) {
    const [rows] = await pool.execute(
      `SELECT 
          DATE(created_at) as date,
          COUNT(*) as message_count,
          COUNT(DISTINCT sender_id) as daily_users,
          COUNT(DISTINCT video_id) as daily_chats,
          AVG(LENGTH(content)) as avg_message_length
       FROM messages 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [days]
    );
    return rows;
  }

  // الحصول على رسائل المستخدم مع الإحصائيات
  static async getUserMessagesStats(userId, days = 30) {
    const [rows] = await pool.execute(
      `SELECT 
          DATE(created_at) as date,
          COUNT(*) as message_count,
          COUNT(DISTINCT video_id) as active_chats,
          AVG(LENGTH(content)) as avg_length
       FROM messages 
       WHERE sender_id = ? 
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [userId, days]
    );
    return rows;
  }

  // تحديث رسالة (للتعديل)
  static async updateMessage(messageId, content, userId = null) {
    let query = 'UPDATE messages SET content = ?, updated_at = NOW() WHERE id = ?';
    const params = [content, messageId];

    if (userId) {
      query += ' AND sender_id = ?';
      params.push(userId);
    }

    const [result] = await pool.execute(query, params);

    if (result.affectedRows > 0) {
      const [updatedMessage] = await pool.execute(
        'SELECT * FROM messages WHERE id = ?',
        [messageId]
      );
      return updatedMessage[0];
    }

    return null;
  }

  // الحصول على توزيع الرسائل على مدار الوقت
  static async getMessageTimeDistribution(hours = 24) {
    const [rows] = await pool.execute(
      `SELECT 
          HOUR(created_at) as hour,
          COUNT(*) as message_count,
          COUNT(DISTINCT sender_id) as unique_senders
       FROM messages 
       WHERE created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
       GROUP BY HOUR(created_at)
       ORDER BY hour ASC`,
      [hours]
    );
    return rows;
  }

  // الحصول على أحدث الرسائل من جميع الغرف
  static async getRecentMessagesFromAllRooms(limit = 50) {
    const [rows] = await pool.execute(
      `SELECT m.*, u.username, u.avatar, v.title as video_title,
              (SELECT COUNT(*) FROM message_displays WHERE message_id = m.id) as display_count
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN videos v ON m.video_id = v.id
       WHERE m.created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
         AND u.is_banned = FALSE
         AND v.deleted_by_admin = FALSE
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  }

  // التحقق من صلاحيات المستخدم للرسالة
  static async checkMessageOwnership(messageId, userId) {
    const [rows] = await pool.execute(
      'SELECT sender_id FROM messages WHERE id = ?',
      [messageId]
    );

    if (rows.length === 0) return false;
    return rows[0].sender_id === userId;
  }
}