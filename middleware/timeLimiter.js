// server/middleware/timeLimiter.js
import { pool } from '../config/db.js';

const MAX_WATCH_TIME = 3 * 60 * 60 * 1000; // 3 ساعات

class TimeLimiter {
  // تسجيل نشاط المشاهدة
  static async recordWatchActivity(userId, videoId, watchTime) {
    try {
      await pool.execute(
        `INSERT INTO user_watch_sessions (user_id, video_id, start_time, last_activity, total_watch_time, is_active)
         VALUES (?, ?, NOW(), NOW(), ?, TRUE)
         ON DUPLICATE KEY UPDATE
         last_activity = NOW(),
         total_watch_time = total_watch_time + ?,
         is_active = TRUE`,
        [userId, videoId, watchTime, watchTime]
      );
    } catch (error) {
      console.error('Error recording watch activity:', error);
    }
  }

  // التحقق إذا تجاوز المستخدم الحد الزمني
  static async checkTimeLimit(userId, videoId) {
    try {
      const [sessions] = await pool.execute(
        `SELECT total_watch_time, start_time, last_activity
         FROM user_watch_sessions 
         WHERE user_id = ? AND video_id = ? AND is_active = TRUE
         ORDER BY last_activity DESC 
         LIMIT 1`,
        [userId, videoId]
      );

      if (sessions.length === 0) {
        return { exceeded: false, remainingTime: MAX_WATCH_TIME };
      }

      const session = sessions[0];
      const totalWatchTime = session.total_watch_time;
      
      // حساب الوقت المنقضي منذ آخر نشاط
      const lastActivity = new Date(session.last_activity);
      const now = new Date();
      const timeSinceLastActivity = now - lastActivity;

      // إذا مر أكثر من 30 دقيقة منذ آخر نشاط، نعتبر الجلسة منتهية
      if (timeSinceLastActivity > 30 * 60 * 1000) {
        await pool.execute(
          'UPDATE user_watch_sessions SET is_active = FALSE WHERE user_id = ? AND video_id = ?',
          [userId, videoId]
        );
        return { exceeded: false, remainingTime: MAX_WATCH_TIME };
      }

      const exceeded = totalWatchTime >= MAX_WATCH_TIME;
      const remainingTime = Math.max(0, MAX_WATCH_TIME - totalWatchTime);

      return { exceeded, remainingTime, totalWatchTime };
    } catch (error) {
      console.error('Error checking time limit:', error);
      return { exceeded: false, remainingTime: MAX_WATCH_TIME };
    }
  }

  // إغلاق جلسة المشاهدة
  static async closeWatchSession(userId, videoId) {
    try {
      await pool.execute(
        'UPDATE user_watch_sessions SET is_active = FALSE WHERE user_id = ? AND video_id = ?',
        [userId, videoId]
      );
    } catch (error) {
      console.error('Error closing watch session:', error);
    }
  }

  // إعادة تعيين جلسة المشاهدة
  static async resetWatchSession(userId, videoId) {
    try {
      await pool.execute(
        'UPDATE user_watch_sessions SET total_watch_time = 0, is_active = TRUE WHERE user_id = ? AND video_id = ?',
        [userId, videoId]
      );
    } catch (error) {
      console.error('Error resetting watch session:', error);
    }
  }

  // الحصول على إحصائيات المشاهدة للمستخدم
  static async getUserWatchStats(userId) {
    try {
      const [stats] = await pool.execute(
        `SELECT video_id, total_watch_time, start_time, last_activity
         FROM user_watch_sessions 
         WHERE user_id = ? AND is_active = TRUE
         ORDER BY last_activity DESC`,
        [userId]
      );

      return stats;
    } catch (error) {
      console.error('Error getting user watch stats:', error);
      return [];
    }
  }
}

// Middleware للتحقق من الحد الزمني
export const timeLimitMiddleware = async (req, res, next) => {
  try {
    const { userId, videoId } = req.body;

    if (!userId || !videoId) {
      return next();
    }

    const timeCheck = await TimeLimiter.checkTimeLimit(userId, videoId);
    
    if (timeCheck.exceeded) {
      return res.status(429).json({
        success: false,
        message: 'Maximum watch time exceeded for this video',
        code: 'TIME_LIMIT_EXCEEDED',
        remainingTime: 0,
        totalWatchTime: timeCheck.totalWatchTime
      });
    }

    req.timeLimitInfo = timeCheck;
    next();
  } catch (error) {
    console.error('Time limit middleware error:', error);
    next();
  }
};

export default TimeLimiter;