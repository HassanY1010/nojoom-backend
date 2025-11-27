import { pool } from '../config/db.js';

// Get user notifications with pagination
export const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, type } = req.query;
        const offset = (page - 1) * limit;

        let query = `
      SELECT 
        n.*,
        u.username as actor_username,
        u.avatar as actor_avatar
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      WHERE n.user_id = ?
    `;

        const params = [userId];

        if (type && type !== 'all') {
            query += ' AND n.type = ?';
            params.push(type);
        }

        query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [notifications] = await pool.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
        const countParams = [userId];

        if (type && type !== 'all') {
            countQuery += ' AND type = ?';
            countParams.push(type);
        }

        const [[{ total }]] = await pool.query(countQuery, countParams);

        res.json({
            notifications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

// Get unread count
export const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const [[{ count }]] = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        res.json({ count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Failed to mark as read' });
    }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
};

// Delete notification
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await pool.query(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};

// Create notification (helper function)
export const createNotification = async (userId, type, actorId, targetId, targetType, message) => {
    try {
        // Don't create notification if actor is the same as recipient
        if (userId === actorId) return;

        const [result] = await pool.query(
            'INSERT INTO notifications (user_id, type, actor_id, target_id, target_type, message) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, type, actorId, targetId, targetType, message]
        );

        // Get the created notification with actor info
        const [[notification]] = await pool.query(
            `SELECT 
        n.*,
        u.username as actor_username,
        u.avatar as actor_avatar
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      WHERE n.id = ?`,
            [result.insertId]
        );

        return notification;
    } catch (error) {
        console.error('Create notification error:', error);
        throw error;
    }
};
