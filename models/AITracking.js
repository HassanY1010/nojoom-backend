// models/AITracking.js
import { pool } from '../config/db.js';

class AITracking {
    // ============ Eye Tracking ============

    /**
     * تسجيل بيانات تتبع العين
     */
    static async recordEyeTracking(data) {
        try {
            const { userId, videoId, gazePoints, attentionScore, focusDuration, viewportData } = data;

            const [result] = await pool.execute(
                `INSERT INTO eye_tracking 
          (user_id, video_id, gaze_points, attention_score, focus_duration, viewport_data) 
         VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    videoId,
                    JSON.stringify(gazePoints || []),
                    attentionScore || 0,
                    focusDuration || 0,
                    JSON.stringify(viewportData || {})
                ]
            );

            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error recording eye tracking:', error);
            throw error;
        }
    }

    /**
     * الحصول على بيانات تتبع العين للمستخدم
     */
    static async getUserEyeTracking(userId, limit = 100) {
        try {
            const [rows] = await pool.execute(
                `SELECT * FROM eye_tracking 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
                [userId, limit]
            );
            return rows;
        } catch (error) {
            console.error('Error getting user eye tracking:', error);
            throw error;
        }
    }

    /**
     * حساب متوسط درجة الانتباه للفيديو
     */
    static async getVideoAttentionScore(videoId) {
        try {
            const [rows] = await pool.execute(
                `SELECT AVG(attention_score) as avg_attention 
         FROM eye_tracking 
         WHERE video_id = ?`,
                [videoId]
            );
            return rows[0]?.avg_attention || 0;
        } catch (error) {
            console.error('Error getting video attention score:', error);
            return 0;
        }
    }

    // ============ Scroll Behavior ============

    /**
     * تسجيل سلوك التمرير
     */
    static async recordScrollBehavior(data) {
        try {
            const {
                userId,
                videoId,
                scrollSpeed,
                scrollPattern,
                pauseDuration,
                engagementScore,
                swipeDirection
            } = data;

            const [result] = await pool.execute(
                `INSERT INTO scroll_behavior 
          (user_id, video_id, scroll_speed, scroll_pattern, pause_duration, engagement_score, swipe_direction) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    videoId,
                    scrollSpeed || 0,
                    scrollPattern || 'normal',
                    pauseDuration || 0,
                    engagementScore || 0,
                    swipeDirection || 'down'
                ]
            );

            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error recording scroll behavior:', error);
            throw error;
        }
    }

    /**
     * تحليل أنماط التمرير للمستخدم
     */
    static async analyzeUserScrollPatterns(userId, limit = 50) {
        try {
            const [rows] = await pool.execute(
                `SELECT 
          AVG(scroll_speed) as avg_speed,
          AVG(engagement_score) as avg_engagement,
          COUNT(*) as total_scrolls,
          scroll_pattern,
          COUNT(*) as pattern_count
         FROM scroll_behavior 
         WHERE user_id = ? 
         GROUP BY scroll_pattern
         ORDER BY pattern_count DESC
         LIMIT ?`,
                [userId, limit]
            );
            return rows;
        } catch (error) {
            console.error('Error analyzing scroll patterns:', error);
            return [];
        }
    }

    // ============ Voice Interactions ============

    /**
     * تسجيل التفاعل الصوتي
     */
    static async recordVoiceInteraction(data) {
        try {
            const {
                userId,
                videoId,
                interactionType,
                duration,
                intensity,
                timestampInVideo
            } = data;

            const [result] = await pool.execute(
                `INSERT INTO voice_interactions 
          (user_id, video_id, interaction_type, duration, intensity, timestamp_in_video) 
         VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    videoId,
                    interactionType || 'reaction',
                    duration || 0,
                    intensity || 0,
                    timestampInVideo || 0
                ]
            );

            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error recording voice interaction:', error);
            throw error;
        }
    }

    /**
     * الحصول على التفاعلات الصوتية للمستخدم
     */
    static async getUserVoiceInteractions(userId, limit = 100) {
        try {
            const [rows] = await pool.execute(
                `SELECT * FROM voice_interactions 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
                [userId, limit]
            );
            return rows;
        } catch (error) {
            console.error('Error getting voice interactions:', error);
            return [];
        }
    }

    // ============ AI User Profiles ============

    /**
     * إنشاء أو تحديث ملف المستخدم AI
     */
    static async upsertUserProfile(userId, profileData) {
        try {
            const {
                eyeTrackingEnabled,
                voiceTrackingEnabled,
                scrollTrackingEnabled,
                preferences
            } = profileData;

            const [result] = await pool.execute(
                `INSERT INTO ai_user_profiles 
          (user_id, eye_tracking_enabled, voice_tracking_enabled, scroll_tracking_enabled, preferences) 
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          eye_tracking_enabled = VALUES(eye_tracking_enabled),
          voice_tracking_enabled = VALUES(voice_tracking_enabled),
          scroll_tracking_enabled = VALUES(scroll_tracking_enabled),
          preferences = VALUES(preferences),
          last_updated = CURRENT_TIMESTAMP`,
                [
                    userId,
                    eyeTrackingEnabled !== undefined ? eyeTrackingEnabled : false,
                    voiceTrackingEnabled !== undefined ? voiceTrackingEnabled : false,
                    scrollTrackingEnabled !== undefined ? scrollTrackingEnabled : true,
                    JSON.stringify(preferences || {})
                ]
            );

            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error upserting user profile:', error);
            throw error;
        }
    }

    /**
     * الحصول على ملف المستخدم AI
     */
    static async getUserProfile(userId) {
        try {
            const [rows] = await pool.execute(
                `SELECT * FROM ai_user_profiles WHERE user_id = ?`,
                [userId]
            );

            if (rows.length === 0) {
                // إنشاء ملف افتراضي
                await this.upsertUserProfile(userId, {
                    eyeTrackingEnabled: false,
                    voiceTrackingEnabled: false,
                    scrollTrackingEnabled: true,
                    preferences: {}
                });

                const [newRows] = await pool.execute(
                    `SELECT * FROM ai_user_profiles WHERE user_id = ?`,
                    [userId]
                );
                return newRows[0];
            }

            return rows[0];
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    /**
     * تحديث تفضيلات المستخدم AI
     */
    static async updateUserPreferences(userId, preferences) {
        try {
            await pool.execute(
                `UPDATE ai_user_profiles 
         SET preferences = ?, last_updated = CURRENT_TIMESTAMP 
         WHERE user_id = ?`,
                [JSON.stringify(preferences), userId]
            );

            return { success: true };
        } catch (error) {
            console.error('Error updating user preferences:', error);
            throw error;
        }
    }

    /**
     * تحديث بيانات الملف الشخصي AI
     */
    static async updateProfileData(userId, profileData) {
        try {
            await pool.execute(
                `UPDATE ai_user_profiles 
         SET profile_data = ?, last_updated = CURRENT_TIMESTAMP 
         WHERE user_id = ?`,
                [JSON.stringify(profileData), userId]
            );

            return { success: true };
        } catch (error) {
            console.error('Error updating profile data:', error);
            throw error;
        }
    }

    // ============ AI Training Data ============

    /**
     * تسجيل بيانات التدريب
     */
    static async recordTrainingData(data) {
        try {
            const {
                userId,
                videoId,
                interactionData,
                predictionScore,
                actualEngagement
            } = data;

            const accuracy = predictionScore && actualEngagement
                ? 100 - Math.abs(predictionScore - actualEngagement)
                : null;

            const [result] = await pool.execute(
                `INSERT INTO ai_training_data 
          (user_id, video_id, interaction_data, prediction_score, actual_engagement, accuracy) 
         VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    videoId,
                    JSON.stringify(interactionData || {}),
                    predictionScore || null,
                    actualEngagement || null,
                    accuracy
                ]
            );

            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error recording training data:', error);
            throw error;
        }
    }

    /**
     * الحصول على دقة النموذج
     */
    static async getModelAccuracy(userId = null) {
        try {
            const query = userId
                ? `SELECT AVG(accuracy) as avg_accuracy FROM ai_training_data WHERE user_id = ? AND accuracy IS NOT NULL`
                : `SELECT AVG(accuracy) as avg_accuracy FROM ai_training_data WHERE accuracy IS NOT NULL`;

            const params = userId ? [userId] : [];
            const [rows] = await pool.execute(query, params);

            return rows[0]?.avg_accuracy || 0;
        } catch (error) {
            console.error('Error getting model accuracy:', error);
            return 0;
        }
    }

    // ============ Data Management ============

    /**
     * حذف جميع بيانات AI للمستخدم
     */
    static async deleteUserAIData(userId) {
        try {
            await pool.execute(`DELETE FROM eye_tracking WHERE user_id = ?`, [userId]);
            await pool.execute(`DELETE FROM scroll_behavior WHERE user_id = ?`, [userId]);
            await pool.execute(`DELETE FROM voice_interactions WHERE user_id = ?`, [userId]);
            await pool.execute(`DELETE FROM ai_training_data WHERE user_id = ?`, [userId]);
            await pool.execute(`DELETE FROM ai_user_profiles WHERE user_id = ?`, [userId]);

            return { success: true, message: 'All AI data deleted successfully' };
        } catch (error) {
            console.error('Error deleting user AI data:', error);
            throw error;
        }
    }

    /**
     * الحصول على إحصائيات AI للمستخدم
     */
    static async getUserAIStats(userId) {
        try {
            const [eyeTracking] = await pool.execute(
                `SELECT COUNT(*) as count, AVG(attention_score) as avg_attention 
         FROM eye_tracking WHERE user_id = ?`,
                [userId]
            );

            const [scrollBehavior] = await pool.execute(
                `SELECT COUNT(*) as count, AVG(engagement_score) as avg_engagement 
         FROM scroll_behavior WHERE user_id = ?`,
                [userId]
            );

            const [voiceInteractions] = await pool.execute(
                `SELECT COUNT(*) as count, AVG(intensity) as avg_intensity 
         FROM voice_interactions WHERE user_id = ?`,
                [userId]
            );

            const [trainingData] = await pool.execute(
                `SELECT COUNT(*) as count, AVG(accuracy) as avg_accuracy 
         FROM ai_training_data WHERE user_id = ? AND accuracy IS NOT NULL`,
                [userId]
            );

            return {
                eyeTracking: {
                    count: eyeTracking[0].count,
                    avgAttention: eyeTracking[0].avg_attention || 0
                },
                scrollBehavior: {
                    count: scrollBehavior[0].count,
                    avgEngagement: scrollBehavior[0].avg_engagement || 0
                },
                voiceInteractions: {
                    count: voiceInteractions[0].count,
                    avgIntensity: voiceInteractions[0].avg_intensity || 0
                },
                modelAccuracy: trainingData[0].avg_accuracy || 0,
                totalDataPoints: eyeTracking[0].count + scrollBehavior[0].count + voiceInteractions[0].count
            };
        } catch (error) {
            console.error('Error getting user AI stats:', error);
            throw error;
        }
    }
}

export { AITracking };
export default AITracking;
