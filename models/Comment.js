import { pool } from '../config/db.js';

export class Comment {
  // إنشاء تعليق جديد
  static async create(commentData) {
    const { video_id, user_id, username, content } = commentData;
    
    const [result] = await pool.execute(
      `INSERT INTO comments (video_id, user_id, username, content, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [video_id, user_id, username, content]
    );
    
    return result.insertId;
  }

  // الحصول على تعليق بواسطة ID
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT c.*, u.avatar 
       FROM comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.id = ? AND c.deleted_by_admin = FALSE`,
      [id]
    );
    return rows[0];
  }

  // الحصول على جميع تعليقات الفيديو
  static async getByVideoId(videoId, limit = 50, offset = 0) {
    const [rows] = await pool.execute(
      `SELECT c.*, u.avatar,
              (c.user_id = ?) as is_owner
       FROM comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.video_id = ? AND c.deleted_by_admin = FALSE
       ORDER BY c.created_at DESC 
       LIMIT ? OFFSET ?`,
      [0, videoId, limit, offset] // user_id سيتم استبداله عند الاستخدام
    );
    return rows;
  }

  // الحصول على عدد التعليقات للفيديو
  static async getCountByVideoId(videoId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
      [videoId]
    );
    return rows[0].count;
  }

  // حذف تعليق
  static async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM comments WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }

  // حذف تعليق بواسطة الأدمن
  static async deleteByAdmin(commentId, reason = '') {
    const [result] = await pool.execute(
      'UPDATE comments SET deleted_by_admin = TRUE, deletion_reason = ?, deleted_at = NOW() WHERE id = ?',
      [reason || 'Admin deletion', commentId]
    );
    return result.affectedRows > 0;
  }

  // الحصول على تعليقات المستخدم
  static async getByUserId(userId, limit = 20, offset = 0) {
    const [rows] = await pool.execute(
      `SELECT c.*, v.description as video_description 
       FROM comments c 
       JOIN videos v ON c.video_id = v.id 
       WHERE c.user_id = ? AND c.deleted_by_admin = FALSE AND v.deleted_by_admin = FALSE
       ORDER BY c.created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return rows;
  }

  // الإبلاغ عن تعليق
  static async report(commentId, userId, reason) {
    try {
      const [existingReport] = await pool.execute(
        'SELECT id FROM comment_reports WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );

      if (existingReport.length > 0) {
        return { success: false, error: 'Already reported' };
      }

      await pool.execute(
        'INSERT INTO comment_reports (comment_id, user_id, reason, created_at) VALUES (?, ?, ?, NOW())',
        [commentId, userId, reason]
      );

      return { success: true };
    } catch (error) {
      console.error('Report comment error:', error);
      return { success: false, error: error.message };
    }
  }

  // تحديث تعليق
  static async update(id, userId, content) {
    const [result] = await pool.execute(
      'UPDATE comments SET content = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [content, id, userId]
    );
    return result.affectedRows > 0;
  }

  // الحصول على الإحصائيات
  static async getStats(commentId) {
    const [rows] = await pool.execute(
      `SELECT 
         (SELECT COUNT(*) FROM comment_reports WHERE comment_id = ?) as reports_count,
         (SELECT COUNT(*) FROM comment_likes WHERE comment_id = ?) as likes_count
       FROM DUAL`,
      [commentId, commentId]
    );
    return rows[0];
  }
}