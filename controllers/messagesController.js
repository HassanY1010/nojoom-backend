// controllers/messagesController.js
import { Message } from '../models/Message.js';
import { pool } from '../config/db.js';

export const messagesController = {
  // إرسال رسالة مباشرة
  async sendMessage(req, res) {
    try {
      const { receiver_id, content } = req.body;
      const sender_id = req.user.id;

      if (!content || content.trim() === '') {
        return res.status(400).json({ 
          error: 'Message content is required',
          code: 'MESSAGE_CONTENT_REQUIRED'
        });
      }

      if (!receiver_id) {
        return res.status(400).json({ 
          error: 'Receiver ID is required',
          code: 'RECEIVER_ID_REQUIRED'
        });
      }

      if (sender_id === parseInt(receiver_id)) {
        return res.status(400).json({ 
          error: 'Cannot send message to yourself',
          code: 'SELF_MESSAGE_NOT_ALLOWED'
        });
      }

      // التحقق من وجود المستخدم المستقبل
      const [receivers] = await pool.execute(
        'SELECT id, username, is_banned FROM users WHERE id = ?',
        [receiver_id]
      );

      if (receivers.length === 0) {
        return res.status(404).json({ 
          error: 'Receiver not found',
          code: 'RECEIVER_NOT_FOUND'
        });
      }

      if (receivers[0].is_banned) {
        return res.status(403).json({ 
          error: 'Cannot send message to banned user',
          code: 'RECEIVER_BANNED'
        });
      }

      const messageId = await Message.createDirectMessage({
        sender_id,
        receiver_id: parseInt(receiver_id),
        content: content.trim()
      });

      // الحصول على بيانات الرسالة الكاملة
      const message = await Message.getMessageWithDetails(messageId);

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // الحصول على محادثة مع مستخدم
  async getConversation(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      if (!userId) {
        return res.status(400).json({ 
          error: 'User ID is required',
          code: 'USER_ID_REQUIRED'
        });
      }

      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const messages = await Message.getConversation(
        currentUserId, 
        parseInt(userId), 
        parseInt(limit), 
        offset
      );

      // تحديث الرسائل كمقروءة
      await Message.markAsRead(parseInt(userId), currentUserId);

      res.json({ 
        success: true,
        data: {
          messages,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: messages.length
          }
        }
      });
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // الحصول على قائمة المحادثات
  async getConversations(req, res) {
    try {
      const userId = req.user.id;
      const conversations = await Message.getUserConversations(userId);

      res.json({ 
        success: true,
        data: conversations 
      });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // الحصول على عدد الرسائل غير المقروءة
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      const unreadCount = await Message.getUnreadCount(userId);

      res.json({ 
        success: true,
        data: { unread_count: unreadCount } 
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // وضع علامة مقروء على رسائل محادثة
  async markAsRead(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      if (!userId) {
        return res.status(400).json({ 
          error: 'User ID is required',
          code: 'USER_ID_REQUIRED'
        });
      }

      const affectedRows = await Message.markAsRead(parseInt(userId), currentUserId);

      res.json({ 
        success: true,
        message: 'Messages marked as read',
        data: { marked_count: affectedRows }
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // البحث في الرسائل
  async searchMessages(req, res) {
    try {
      const { q: query } = req.query;
      const userId = req.user.id;

      if (!query || query.trim() === '') {
        return res.status(400).json({ 
          error: 'Search query is required',
          code: 'SEARCH_QUERY_REQUIRED'
        });
      }

      const messages = await Message.searchMessages(userId, query.trim());

      res.json({ 
        success: true,
        data: messages 
      });
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // حذف محادثة
  async deleteConversation(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      if (!userId) {
        return res.status(400).json({ 
          error: 'User ID is required',
          code: 'USER_ID_REQUIRED'
        });
      }

      const deletedCount = await Message.deleteConversation(currentUserId, parseInt(userId));

      res.json({ 
        success: true,
        message: 'Conversation deleted successfully',
        data: { deleted_count: deletedCount }
      });
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  },

  // الحصول على إحصائيات الرسائل
  async getMessageStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await Message.getMessageStats(userId);

      res.json({ 
        success: true,
        data: stats 
      });
    } catch (error) {
      console.error('Get message stats error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
};