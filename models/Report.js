import { pool } from '../config/db.js';

export class Report {
  static async create(reportData) {
    const { reporter_id, video_id, reported_user_id, reason, description } = reportData;
    
    const [result] = await pool.execute(
      'INSERT INTO reports (reporter_id, video_id, reported_user_id, reason, description, status) VALUES (?, ?, ?, ?, ?, "pending")',
      [reporter_id, video_id, reported_user_id, reason, description]
    );
    
    return result.insertId;
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT r.*, 
             v.path as video_path, 
             v.description as video_description,
             v.deleted_by_admin,
             u_reporter.username as reporter_username,
             u_reporter.avatar as reporter_avatar,
             u_reporter.email as reporter_email,
             u_video_owner.username as video_owner_username,
             u_video_owner.email as video_owner_email,
             u_video_owner.avatar as video_owner_avatar,
             u_admin.username as admin_username
      FROM reports r
      LEFT JOIN videos v ON r.video_id = v.id
      LEFT JOIN users u_reporter ON r.reporter_id = u_reporter.id
      LEFT JOIN users u_video_owner ON r.reported_user_id = u_video_owner.id
      LEFT JOIN users u_admin ON r.admin_id = u_admin.id
      WHERE 1=1
    `;
    
    const conditions = [];
    const params = [];
    
    if (filters.status) {
      conditions.push('r.status = ?');
      params.push(filters.status);
    }
    
    if (filters.video_id) {
      conditions.push('r.video_id = ?');
      params.push(filters.video_id);
    }
    
    if (filters.reporter_id) {
      conditions.push('r.reporter_id = ?');
      params.push(filters.reporter_id);
    }
    
    if (filters.reported_user_id) {
      conditions.push('r.reported_user_id = ?');
      params.push(filters.reported_user_id);
    }
    
    if (filters.reason) {
      conditions.push('r.reason = ?');
      params.push(filters.reason);
    }
    
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY r.created_at DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }
    
    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(parseInt(filters.offset));
    }
    
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT r.*, 
              v.path as video_path, 
              v.description as video_description,
              v.user_id as video_owner_id,
              v.deleted_by_admin,
              u_reporter.username as reporter_username,
              u_reporter.avatar as reporter_avatar,
              u_reporter.email as reporter_email,
              u_video_owner.username as video_owner_username,
              u_video_owner.email as video_owner_email,
              u_video_owner.avatar as video_owner_avatar,
              u_admin.username as admin_username,
              u_admin.email as admin_email
       FROM reports r
       LEFT JOIN videos v ON r.video_id = v.id
       LEFT JOIN users u_reporter ON r.reporter_id = u_reporter.id
       LEFT JOIN users u_video_owner ON r.reported_user_id = u_video_owner.id
       LEFT JOIN users u_admin ON r.admin_id = u_admin.id
       WHERE r.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async updateStatus(id, status, adminId = null, adminNotes = null) {
    const updateData = {
      status: status,
      updated_at: new Date()
    };
    
    if (adminId) {
      updateData.admin_id = adminId;
    }
    
    if (adminNotes !== null) {
      updateData.admin_notes = adminNotes;
    }
    
    if (status === 'resolved' || status === 'rejected') {
      updateData.resolved_at = new Date();
    }
    
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), id];
    
    const [result] = await pool.execute(
      `UPDATE reports SET ${fields} WHERE id = ?`,
      values
    );
    
    return result.affectedRows > 0;
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM reports 
      GROUP BY status
    `);
    
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const pending = rows.find(row => row.status === 'pending')?.count || 0;
    const resolved = rows.find(row => row.status === 'resolved')?.count || 0;
    const rejected = rows.find(row => row.status === 'rejected')?.count || 0;
    
    return {
      total,
      pending,
      resolved,
      rejected,
      reviewed: resolved + rejected // للحفاظ على التوافق مع الكود القديم
    };
  }

  static async getReports(page = 1, limit = 10, status = '') {
    try {
      const offset = (page - 1) * limit;
      let query = `
        SELECT r.*, 
               reporter.username as reporter_username,
               reporter.email as reporter_email,
               reporter.avatar as reporter_avatar,
               reported.username as reported_username,
               reported.email as reported_email,
               reported.avatar as reported_avatar,
               v.description as video_description,
               v.path as video_path,
               v.user_id as video_owner_id,
               admin.username as admin_username
        FROM reports r
        LEFT JOIN users reporter ON r.reporter_id = reporter.id
        LEFT JOIN users reported ON r.reported_user_id = reported.id
        LEFT JOIN videos v ON r.video_id = v.id
        LEFT JOIN users admin ON r.admin_id = admin.id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) as total FROM reports r WHERE 1=1`;
      const params = [];
      const countParams = [];

      if (status) {
        query += ' AND r.status = ?';
        countQuery += ' AND r.status = ?';
        params.push(status);
        countParams.push(status);
      }

      query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [reports] = await pool.execute(query, params);
      const [totalResult] = await pool.execute(countQuery, countParams);

      return {
        reports,
        total: totalResult[0].total,
        page,
        totalPages: Math.ceil(totalResult[0].total / limit)
      };
    } catch (error) {
      console.error('Error in Report.getReports:', error);
      throw error;
    }
  }

  static async getReportById(id) {
    const [rows] = await pool.execute(
      `SELECT r.*, 
              reporter.username as reporter_username,
              reporter.email as reporter_email,
              reporter.avatar as reporter_avatar,
              reported.username as reported_username,
              reported.email as reported_email,
              reported.avatar as reported_avatar,
              v.description as video_description,
              v.path as video_path,
              v.user_id as video_owner_id,
              v.deleted_by_admin,
              admin.username as admin_username,
              admin.email as admin_email
       FROM reports r
       LEFT JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported ON r.reported_user_id = reported.id
       LEFT JOIN videos v ON r.video_id = v.id
       LEFT JOIN users admin ON r.admin_id = admin.id
       WHERE r.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async userHasReportedVideo(userId, videoId) {
    const [rows] = await pool.execute(
      'SELECT id FROM reports WHERE reporter_id = ? AND video_id = ? AND status IN ("pending", "reviewed")',
      [userId, videoId]
    );
    return rows.length > 0;
  }

  static async deleteReportsForVideo(videoId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM reports WHERE video_id = ?',
        [videoId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Report.deleteReportsForVideo:', error);
      throw error;
    }
  }

  static async deleteReportsForUser(userId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM reports WHERE reported_user_id = ?',
        [userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Report.deleteReportsForUser:', error);
      throw error;
    }
  }

  static async getReportsByReason() {
    const [rows] = await pool.execute(`
      SELECT 
        reason,
        COUNT(*) as count
      FROM reports 
      WHERE status = 'pending'
      GROUP BY reason
      ORDER BY count DESC
    `);
    return rows;
  }

  static async getRecentReports(limit = 5) {
    const [rows] = await pool.execute(`
      SELECT r.*, 
             reporter.username as reporter_username,
             reported.username as reported_username,
             v.description as video_description
      FROM reports r
      LEFT JOIN users reporter ON r.reporter_id = reporter.id
      LEFT JOIN users reported ON r.reported_user_id = reported.id
      LEFT JOIN videos v ON r.video_id = v.id
      ORDER BY r.created_at DESC
      LIMIT ?
    `, [limit]);
    return rows;
  }

  static async getReportsCountByPeriod(days = 7) {
    const [rows] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM reports 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);
    return rows;
  }

  static async resolveMultipleReports(reportIds, adminId, adminNotes = 'Bulk resolution') {
    try {
      const placeholders = reportIds.map(() => '?').join(',');
      const [result] = await pool.execute(
        `UPDATE reports 
         SET status = 'resolved', admin_id = ?, admin_notes = ?, resolved_at = NOW(), updated_at = NOW()
         WHERE id IN (${placeholders}) AND status = 'pending'`,
        [adminId, adminNotes, ...reportIds]
      );
      return result.affectedRows;
    } catch (error) {
      console.error('Error in Report.resolveMultipleReports:', error);
      throw error;
    }
  }

  static async getReportsWithVideos(status = 'pending') {
    const [rows] = await pool.execute(`
      SELECT r.*, 
             v.path as video_path,
             v.description as video_description,
             v.user_id as video_owner_id,
             video_owner.username as video_owner_username,
             reporter.username as reporter_username
      FROM reports r
      JOIN videos v ON r.video_id = v.id
      JOIN users video_owner ON v.user_id = video_owner.id
      JOIN users reporter ON r.reporter_id = reporter.id
      WHERE r.status = ? AND v.deleted_by_admin = FALSE
      ORDER BY r.created_at DESC
    `, [status]);
    return rows;
  }

  static async getTopReportedUsers(limit = 10) {
    const [rows] = await pool.execute(`
      SELECT 
        reported_user_id,
        u.username,
        u.avatar,
        COUNT(*) as report_count
      FROM reports r
      JOIN users u ON r.reported_user_id = u.id
      WHERE r.status = 'pending'
      GROUP BY reported_user_id, u.username, u.avatar
      ORDER BY report_count DESC
      LIMIT ?
    `, [limit]);
    return rows;
  }

  static async getTopReportedVideos(limit = 10) {
    const [rows] = await pool.execute(`
      SELECT 
        video_id,
        v.description as video_description,
        v.path as video_path,
        u.username as owner_username,
        COUNT(*) as report_count
      FROM reports r
      JOIN videos v ON r.video_id = v.id
      JOIN users u ON v.user_id = u.id
      WHERE r.status = 'pending' AND v.deleted_by_admin = FALSE
      GROUP BY video_id, v.description, v.path, u.username
      ORDER BY report_count DESC
      LIMIT ?
    `, [limit]);
    return rows;
  }
}