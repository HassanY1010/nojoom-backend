// services/aiRecommendationService.js
import { pool } from '../config/db.js';
import { AITracking } from '../models/AITracking.js';
import recommendationEngine from './recommendationEngine.js';

class AIRecommendationService {
    constructor() {
        // أوزان الذكاء الاصطناعي
        this.weights = {
            eyeTracking: 3.0,      // أعلى وزن - تتبع العين دقيق جداً
            voiceInteraction: 2.5, // وزن عالي - يدل على تفاعل قوي
            scrollBehavior: 2.0,   // وزن متوسط - يدل على الاهتمام
            watchTime: 2.5,        // وزن عالي - مؤشر قوي
            contentMatch: 1.5      // وزن أساسي
        };

        // عتبات التقييم
        this.thresholds = {
            highAttention: 0.7,    // 70% انتباه = اهتمام عالي
            mediumAttention: 0.4,  // 40% انتباه = اهتمام متوسط
            slowScroll: 100,       // سرعة تمرير بطيئة = اهتمام
            fastScroll: 500,       // سرعة تمرير سريعة = عدم اهتمام
            minWatchTime: 3        // 3 ثواني كحد أدنى
        };
    }

    /**
     * حساب درجة AI الشاملة للفيديو بناءً على تفاعلات المستخدم
     */
    async calculateAIScore(userId, videoId) {
        try {
            const scores = {
                eyeTracking: await this.getEyeTrackingScore(userId, videoId),
                voiceInteraction: await this.getVoiceInteractionScore(userId, videoId),
                scrollBehavior: await this.getScrollBehaviorScore(userId, videoId),
                watchTime: await this.getWatchTimeScore(userId, videoId),
                contentMatch: await this.getContentMatchScore(userId, videoId)
            };

            // حساب الدرجة الإجمالية مع الأوزان
            const totalScore = (
                scores.eyeTracking * this.weights.eyeTracking +
                scores.voiceInteraction * this.weights.voiceInteraction +
                scores.scrollBehavior * this.weights.scrollBehavior +
                scores.watchTime * this.weights.watchTime +
                scores.contentMatch * this.weights.contentMatch
            ) / (
                    this.weights.eyeTracking +
                    this.weights.voiceInteraction +
                    this.weights.scrollBehavior +
                    this.weights.watchTime +
                    this.weights.contentMatch
                );

            return {
                totalScore: parseFloat(totalScore.toFixed(2)),
                breakdown: scores,
                confidence: this.calculateConfidence(scores)
            };
        } catch (error) {
            console.error('Error calculating AI score:', error);
            return { totalScore: 0, breakdown: {}, confidence: 0 };
        }
    }

    /**
     * حساب درجة تتبع العين
     */
    async getEyeTrackingScore(userId, videoId) {
        try {
            const [rows] = await pool.execute(
                `SELECT AVG(attention_score) as avg_attention, AVG(focus_duration) as avg_focus
         FROM eye_tracking 
         WHERE user_id = ? AND video_id = ?`,
                [userId, videoId]
            );

            if (!rows[0] || rows[0].avg_attention === null) return 0;

            const attentionScore = rows[0].avg_attention / 100; // تحويل إلى 0-1
            const focusBonus = Math.min(rows[0].avg_focus / 10, 0.3); // مكافأة للتركيز الطويل

            return Math.min(attentionScore + focusBonus, 1.0);
        } catch (error) {
            console.error('Error getting eye tracking score:', error);
            return 0;
        }
    }

    /**
     * حساب درجة التفاعل الصوتي
     */
    async getVoiceInteractionScore(userId, videoId) {
        try {
            const [rows] = await pool.execute(
                `SELECT COUNT(*) as count, AVG(intensity) as avg_intensity, SUM(duration) as total_duration
         FROM voice_interactions 
         WHERE user_id = ? AND video_id = ?`,
                [userId, videoId]
            );

            if (!rows[0] || rows[0].count === 0) return 0;

            const interactionCount = rows[0].count;
            const intensity = rows[0].avg_intensity / 100; // تحويل إلى 0-1
            const duration = Math.min(rows[0].total_duration / 5000, 0.3); // مكافأة للمدة

            // كلما زادت التفاعلات الصوتية، زاد الاهتمام
            return Math.min((interactionCount * 0.2) + intensity + duration, 1.0);
        } catch (error) {
            console.error('Error getting voice interaction score:', error);
            return 0;
        }
    }

    /**
     * حساب درجة سلوك التمرير
     */
    async getScrollBehaviorScore(userId, videoId) {
        try {
            const [rows] = await pool.execute(
                `SELECT AVG(scroll_speed) as avg_speed, AVG(pause_duration) as avg_pause, AVG(engagement_score) as avg_engagement
         FROM scroll_behavior 
         WHERE user_id = ? AND video_id = ?`,
                [userId, videoId]
            );

            if (!rows[0] || rows[0].avg_speed === null) return 0.5; // درجة محايدة

            const speed = rows[0].avg_speed;
            const pauseDuration = rows[0].avg_pause || 0;
            const engagement = rows[0].avg_engagement || 0;

            // التمرير البطيء = اهتمام عالي
            let speedScore = 0;
            if (speed < this.thresholds.slowScroll) {
                speedScore = 0.8; // اهتمام عالي
            } else if (speed < this.thresholds.fastScroll) {
                speedScore = 0.5; // اهتمام متوسط
            } else {
                speedScore = 0.2; // تمرير سريع = عدم اهتمام
            }

            // مكافأة للتوقف المؤقت (يشير إلى المشاهدة)
            const pauseBonus = Math.min(pauseDuration / 10000, 0.2);

            return Math.min(speedScore + pauseBonus + (engagement / 100), 1.0);
        } catch (error) {
            console.error('Error getting scroll behavior score:', error);
            return 0.5;
        }
    }

    /**
     * حساب درجة وقت المشاهدة
     */
    async getWatchTimeScore(userId, videoId) {
        try {
            const [rows] = await pool.execute(
                `SELECT watch_time, completed FROM watch_history 
         WHERE user_id = ? AND video_id = ?`,
                [userId, videoId]
            );

            if (!rows[0]) return 0;

            const watchTime = rows[0].watch_time || 0;
            const completed = rows[0].completed;

            if (completed) return 1.0; // مشاهدة كاملة = أعلى درجة

            // حساب النسبة المئوية للمشاهدة
            if (watchTime < this.thresholds.minWatchTime) return 0;

            // افتراض أن الفيديوهات عادة 15-60 ثانية
            const estimatedDuration = 30;
            const watchPercentage = Math.min(watchTime / estimatedDuration, 1.0);

            return watchPercentage;
        } catch (error) {
            console.error('Error getting watch time score:', error);
            return 0;
        }
    }

    /**
     * حساب درجة تطابق المحتوى
     */
    async getContentMatchScore(userId, videoId) {
        try {
            // الحصول على اهتمامات المستخدم من محرك التوصيات
            const interests = await recommendationEngine.analyzeUserInterests(userId);

            // الحصول على معلومات الفيديو
            const [videoRows] = await pool.execute(
                `SELECT description, user_id FROM videos WHERE id = ?`,
                [videoId]
            );

            if (!videoRows[0]) return 0;

            const video = videoRows[0];
            let score = 0;

            // تحليل الوصف
            if (video.description) {
                const videoWords = new Set(
                    video.description.toLowerCase()
                        .replace(/[^\w\s#]/g, ' ')
                        .split(/\s+/)
                        .filter(word => word.length > 2)
                );

                // مقارنة مع اهتمامات المستخدم
                for (const [tag, tagScore] of Object.entries(interests.tags || {})) {
                    if (videoWords.has(tag.toLowerCase())) {
                        score += tagScore * 0.3;
                    }
                }
            }

            // مكافأة إذا كان من منشئ مفضل
            if (interests.creators && interests.creators[video.user_id]) {
                score += interests.creators[video.user_id] * 0.5;
            }

            return Math.min(score, 1.0);
        } catch (error) {
            console.error('Error getting content match score:', error);
            return 0;
        }
    }

    /**
     * حساب مستوى الثقة في التوصية
     */
    calculateConfidence(scores) {
        // عدد المصادر المتاحة
        const availableSources = Object.values(scores).filter(s => s > 0).length;
        const totalSources = Object.keys(scores).length;

        // الثقة تعتمد على عدد المصادر المتاحة
        const sourceConfidence = availableSources / totalSources;

        // الثقة تعتمد على قوة الإشارات
        const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / totalSources;

        return parseFloat(((sourceConfidence * 0.4 + avgScore * 0.6) * 100).toFixed(2));
    }

    /**
     * الحصول على توصيات مدعومة بالذكاء الاصطناعي
     */
    async getAIRecommendations(userId, limit = 20) {
        try {
            console.log(`🤖 Generating AI-powered recommendations for user: ${userId}`);

            // الحصول على ملف المستخدم AI
            const userProfile = await AITracking.getUserProfile(userId);

            // الحصول على التوصيات الأساسية من المحرك الحالي
            const baseRecommendations = await recommendationEngine.getRecommendedVideos(userId, limit * 2);

            // تعزيز التوصيات بدرجات AI
            const enhancedRecommendations = await Promise.all(
                baseRecommendations.map(async (video) => {
                    const aiScore = await this.calculateAIScore(userId, video.id);

                    return {
                        ...video,
                        ai_score: aiScore.totalScore,
                        ai_confidence: aiScore.confidence,
                        ai_breakdown: aiScore.breakdown,
                        // دمج الدرجة الأساسية مع درجة AI
                        final_score: (video.recommendation_score || 0) * 0.4 + aiScore.totalScore * 10 * 0.6
                    };
                })
            );

            // ترتيب حسب الدرجة النهائية
            const sortedRecommendations = enhancedRecommendations
                .sort((a, b) => b.final_score - a.final_score)
                .slice(0, limit);

            console.log(`✅ Generated ${sortedRecommendations.length} AI-powered recommendations`);

            return sortedRecommendations;
        } catch (error) {
            console.error('Error getting AI recommendations:', error);
            // Fallback إلى التوصيات الأساسية
            return await recommendationEngine.getRecommendedVideos(userId, limit);
        }
    }

    /**
     * تحديث نموذج المستخدم بناءً على التفاعلات الجديدة
     */
    async updateUserModel(userId) {
        try {
            // الحصول على إحصائيات AI
            const stats = await AITracking.getUserAIStats(userId);

            // حساب درجة AI الإجمالية
            const totalScore = (
                stats.eyeTracking.avgAttention * this.weights.eyeTracking +
                stats.voiceInteractions.avgIntensity * this.weights.voiceInteraction +
                stats.scrollBehavior.avgEngagement * this.weights.scrollBehavior
            ) / (
                    this.weights.eyeTracking +
                    this.weights.voiceInteraction +
                    this.weights.scrollBehavior
                );

            // تحديث بيانات الملف الشخصي
            const profileData = {
                totalDataPoints: stats.totalDataPoints,
                avgAttention: stats.eyeTracking.avgAttention,
                avgEngagement: stats.scrollBehavior.avgEngagement,
                avgVoiceIntensity: stats.voiceInteractions.avgIntensity,
                modelAccuracy: stats.modelAccuracy,
                lastUpdated: new Date()
            };

            await AITracking.updateProfileData(userId, profileData);

            console.log(`✅ Updated AI model for user: ${userId}`);

            return { success: true, totalScore, stats };
        } catch (error) {
            console.error('Error updating user model:', error);
            throw error;
        }
    }

    /**
     * تسجيل تفاعل وتحديث النموذج
     */
    async recordAndLearn(userId, videoId, interactionType, data) {
        try {
            // تسجيل التفاعل حسب النوع
            switch (interactionType) {
                case 'eye_tracking':
                    await AITracking.recordEyeTracking({ userId, videoId, ...data });
                    break;
                case 'scroll_behavior':
                    await AITracking.recordScrollBehavior({ userId, videoId, ...data });
                    break;
                case 'voice_interaction':
                    await AITracking.recordVoiceInteraction({ userId, videoId, ...data });
                    break;
            }

            // حساب التنبؤ والتفاعل الفعلي لبيانات التدريب
            const prediction = await this.calculateAIScore(userId, videoId);

            await AITracking.recordTrainingData({
                userId,
                videoId,
                interactionData: { type: interactionType, ...data },
                predictionScore: prediction.totalScore,
                actualEngagement: data.engagementScore || null
            });

            return { success: true };
        } catch (error) {
            console.error('Error recording and learning:', error);
            throw error;
        }
    }
}

// إنشاء instance
const aiRecommendationService = new AIRecommendationService();

export { aiRecommendationService, AIRecommendationService };
export default aiRecommendationService;
