// services/videoProgressService.js
import { pool } from '../config/db.js';

/**
 * خدمة إدارة تقدم مشاهدة الفيديو
 * تتيح حفظ واسترجاع آخر نقطة مشاهدة لكل فيديو
 */
class VideoProgressService {
    /**
     * حفظ أو تحديث نقطة المشاهدة الحالية
     * @param {number} userId - معرف المستخدم
     * @param {number} videoId - معرف الفيديو
     * @param {number} lastPosition - آخر ثانية تمت مشاهدتها
     * @param {number} watchTime - إجمالي وقت المشاهدة
     * @param {boolean} completed - هل اكتمل الفيديو
     */
    async saveProgress(userId, videoId, lastPosition, watchTime = 0, completed = false) {
        try {
            await pool.execute(
                `INSERT INTO watch_history (user_id, video_id, last_position, watch_time, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
         last_position = VALUES(last_position),
         watch_time = watch_time + VALUES(watch_time),
         completed = VALUES(completed),
         updated_at = NOW()`,
                [userId, videoId, lastPosition, watchTime, completed]
            );

            console.log(`💾 Saved progress for user ${userId}, video ${videoId}: ${lastPosition}s`);
            return true;
        } catch (error) {
            console.error('❌ Error saving video progress:', error);
            return false;
        }
    }

    /**
     * الحصول على آخر نقطة مشاهدة للفيديو
     * @param {number} userId - معرف المستخدم
     * @param {number} videoId - معرف الفيديو
     * @returns {Promise<object|null>} - معلومات التقدم أو null
     */
    async getProgress(userId, videoId) {
        try {
            const [rows] = await pool.execute(
                `SELECT last_position, watch_time, completed, updated_at
         FROM watch_history
         WHERE user_id = ? AND video_id = ?`,
                [userId, videoId]
            );

            if (rows.length > 0) {
                const progress = rows[0];
                console.log(`📊 Retrieved progress for user ${userId}, video ${videoId}: ${progress.last_position}s`);
                return {
                    lastPosition: parseFloat(progress.last_position) || 0,
                    watchTime: progress.watch_time || 0,
                    completed: progress.completed || false,
                    lastWatched: progress.updated_at
                };
            }

            return null;
        } catch (error) {
            console.error('❌ Error getting video progress:', error);
            return null;
        }
    }

    /**
     * الحصول على جميع الفيديوهات التي شاهدها المستخدم مع نقاط الاستئناف
     * @param {number} userId - معرف المستخدم
     * @param {number} limit - عدد النتائج
     * @returns {Promise<Array>} - قائمة الفيديوهات مع التقدم
     */
    async getUserWatchHistory(userId, limit = 20) {
        try {
            const [rows] = await pool.execute(
                `SELECT wh.video_id, wh.last_position, wh.watch_time, wh.completed, wh.updated_at,
                v.path, v.description, v.thumbnail, v.duration,
                u.username, u.avatar
         FROM watch_history wh
         JOIN videos v ON wh.video_id = v.id
         JOIN users u ON v.user_id = u.id
         WHERE wh.user_id = ? AND v.deleted_by_admin = FALSE
         ORDER BY wh.updated_at DESC
         LIMIT ?`,
                [userId, limit]
            );

            return rows.map(row => ({
                videoId: row.video_id,
                lastPosition: parseFloat(row.last_position) || 0,
                watchTime: row.watch_time || 0,
                completed: row.completed || false,
                lastWatched: row.updated_at,
                video: {
                    path: row.path,
                    description: row.description,
                    thumbnail: row.thumbnail,
                    duration: row.duration,
                    username: row.username,
                    avatar: row.avatar
                }
            }));
        } catch (error) {
            console.error('❌ Error getting user watch history:', error);
            return [];
        }
    }

    /**
     * حذف تقدم المشاهدة لفيديو معين
     * @param {number} userId - معرف المستخدم
     * @param {number} videoId - معرف الفيديو
     */
    async deleteProgress(userId, videoId) {
        try {
            await pool.execute(
                'DELETE FROM watch_history WHERE user_id = ? AND video_id = ?',
                [userId, videoId]
            );

            console.log(`🗑️ Deleted progress for user ${userId}, video ${videoId}`);
            return true;
        } catch (error) {
            console.error('❌ Error deleting video progress:', error);
            return false;
        }
    }

    /**
     * حذف جميع سجلات المشاهدة للمستخدم
     * @param {number} userId - معرف المستخدم
     */
    async clearUserHistory(userId) {
        try {
            await pool.execute(
                'DELETE FROM watch_history WHERE user_id = ?',
                [userId]
            );

            console.log(`🗑️ Cleared all watch history for user ${userId}`);
            return true;
        } catch (error) {
            console.error('❌ Error clearing user watch history:', error);
            return false;
        }
    }

    /**
     * الحصول على الفيديوهات التي لم تكتمل مشاهدتها
     * @param {number} userId - معرف المستخدم
     * @param {number} limit - عدد النتائج
     */
    async getIncompleteVideos(userId, limit = 10) {
        try {
            const [rows] = await pool.execute(
                `SELECT wh.video_id, wh.last_position, wh.watch_time, wh.updated_at,
                v.path, v.description, v.thumbnail, v.duration,
                u.username, u.avatar
         FROM watch_history wh
         JOIN videos v ON wh.video_id = v.id
         JOIN users u ON v.user_id = u.id
         WHERE wh.user_id = ? 
           AND wh.completed = FALSE 
           AND wh.last_position > 5
           AND v.deleted_by_admin = FALSE
         ORDER BY wh.updated_at DESC
         LIMIT ?`,
                [userId, limit]
            );

            return rows.map(row => ({
                videoId: row.video_id,
                lastPosition: parseFloat(row.last_position) || 0,
                watchTime: row.watch_time || 0,
                lastWatched: row.updated_at,
                progressPercentage: row.duration > 0
                    ? Math.round((row.last_position / row.duration) * 100)
                    : 0,
                video: {
                    path: row.path,
                    description: row.description,
                    thumbnail: row.thumbnail,
                    duration: row.duration,
                    username: row.username,
                    avatar: row.avatar
                }
            }));
        } catch (error) {
            console.error('❌ Error getting incomplete videos:', error);
            return [];
        }
    }

    /**
     * تحديث حالة الاكتمال للفيديو
     * @param {number} userId - معرف المستخدم
     * @param {number} videoId - معرف الفيديو
     */
    async markAsCompleted(userId, videoId) {
        try {
            await pool.execute(
                `UPDATE watch_history 
         SET completed = TRUE, updated_at = NOW()
         WHERE user_id = ? AND video_id = ?`,
                [userId, videoId]
            );

            console.log(`✅ Marked video ${videoId} as completed for user ${userId}`);
            return true;
        } catch (error) {
            console.error('❌ Error marking video as completed:', error);
            return false;
        }
    }
}

// تصدير instance واحد من الخدمة
export const videoProgressService = new VideoProgressService();
export default videoProgressService;
