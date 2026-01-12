// controllers/aiTrackingController.js
import { AITracking } from '../models/AITracking.js';
import aiRecommendationService from '../services/aiRecommendationService.js';

/**
 * تسجيل بيانات تتبع العين
 */
export const recordEyeTracking = async (req, res) => {
    try {
        const userId = req.user.id;
        const { videoId, gazePoints, attentionScore, focusDuration, viewportData } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        // تسجيل البيانات
        const result = await AITracking.recordEyeTracking({
            userId,
            videoId,
            gazePoints,
            attentionScore,
            focusDuration,
            viewportData
        });

        // تعلم من البيانات
        await aiRecommendationService.recordAndLearn(userId, videoId, 'eye_tracking', {
            gazePoints,
            attentionScore,
            focusDuration
        });

        res.json({
            success: true,
            message: 'Eye tracking data recorded',
            id: result.id
        });
    } catch (error) {
        console.error('Error recording eye tracking:', error);
        res.status(500).json({ error: 'Failed to record eye tracking data' });
    }
};

/**
 * تسجيل سلوك التمرير
 */
export const recordScrollBehavior = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            videoId,
            scrollSpeed,
            scrollPattern,
            pauseDuration,
            engagementScore,
            swipeDirection
        } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        // تسجيل البيانات
        const result = await AITracking.recordScrollBehavior({
            userId,
            videoId,
            scrollSpeed,
            scrollPattern,
            pauseDuration,
            engagementScore,
            swipeDirection
        });

        // تعلم من البيانات
        await aiRecommendationService.recordAndLearn(userId, videoId, 'scroll_behavior', {
            scrollSpeed,
            scrollPattern,
            pauseDuration,
            engagementScore
        });

        res.json({
            success: true,
            message: 'Scroll behavior recorded',
            id: result.id
        });
    } catch (error) {
        console.error('Error recording scroll behavior:', error);
        res.status(500).json({ error: 'Failed to record scroll behavior' });
    }
};

/**
 * تسجيل التفاعل الصوتي
 */
export const recordVoiceInteraction = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            videoId,
            interactionType,
            duration,
            intensity,
            timestampInVideo
        } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        // تسجيل البيانات
        const result = await AITracking.recordVoiceInteraction({
            userId,
            videoId,
            interactionType,
            duration,
            intensity,
            timestampInVideo
        });

        // تعلم من البيانات
        await aiRecommendationService.recordAndLearn(userId, videoId, 'voice_interaction', {
            interactionType,
            duration,
            intensity
        });

        res.json({
            success: true,
            message: 'Voice interaction recorded',
            id: result.id
        });
    } catch (error) {
        console.error('Error recording voice interaction:', error);
        res.status(500).json({ error: 'Failed to record voice interaction' });
    }
};

/**
 * الحصول على توصيات مدعومة بالذكاء الاصطناعي
 */
export const getAIRecommendations = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;

        const recommendations = await aiRecommendationService.getAIRecommendations(userId, limit);

        res.json({
            success: true,
            recommendations,
            count: recommendations.length,
            aiPowered: true
        });
    } catch (error) {
        console.error('Error getting AI recommendations:', error);
        res.status(500).json({ error: 'Failed to get AI recommendations' });
    }
};

/**
 * الحصول على ملف المستخدم AI
 */
export const getAIProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const profile = await AITracking.getUserProfile(userId);
        const stats = await AITracking.getUserAIStats(userId);

        res.json({
            success: true,
            profile,
            stats
        });
    } catch (error) {
        console.error('Error getting AI profile:', error);
        res.status(500).json({ error: 'Failed to get AI profile' });
    }
};

/**
 * تحديث إعدادات AI للمستخدم
 */
export const updateAISettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            eyeTrackingEnabled,
            voiceTrackingEnabled,
            scrollTrackingEnabled,
            preferences
        } = req.body;

        await AITracking.upsertUserProfile(userId, {
            eyeTrackingEnabled,
            voiceTrackingEnabled,
            scrollTrackingEnabled,
            preferences
        });

        res.json({
            success: true,
            message: 'AI settings updated successfully'
        });
    } catch (error) {
        console.error('Error updating AI settings:', error);
        res.status(500).json({ error: 'Failed to update AI settings' });
    }
};

/**
 * حذف بيانات AI للمستخدم
 */
export const deleteAIData = async (req, res) => {
    try {
        const userId = req.user.id;

        await AITracking.deleteUserAIData(userId);

        res.json({
            success: true,
            message: 'All AI data deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting AI data:', error);
        res.status(500).json({ error: 'Failed to delete AI data' });
    }
};

/**
 * الحصول على إحصائيات AI
 */
export const getAIStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const stats = await AITracking.getUserAIStats(userId);
        const modelAccuracy = await AITracking.getModelAccuracy(userId);

        res.json({
            success: true,
            stats: {
                ...stats,
                modelAccuracy
            }
        });
    } catch (error) {
        console.error('Error getting AI stats:', error);
        res.status(500).json({ error: 'Failed to get AI stats' });
    }
};

/**
 * تحديث نموذج المستخدم
 */
export const updateUserModel = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await aiRecommendationService.updateUserModel(userId);

        res.json({
            success: true,
            message: 'User model updated successfully',
            ...result
        });
    } catch (error) {
        console.error('Error updating user model:', error);
        res.status(500).json({ error: 'Failed to update user model' });
    }
};

/**
 * تسجيل تفاعل مجمع (Batch)
 */
export const recordBatchInteractions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { interactions } = req.body;

        if (!Array.isArray(interactions) || interactions.length === 0) {
            return res.status(400).json({ error: 'Interactions array is required' });
        }

        const results = [];

        for (const interaction of interactions) {
            try {
                const { type, videoId, data } = interaction;

                switch (type) {
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

                results.push({ success: true, type, videoId });
            } catch (error) {
                results.push({ success: false, type: interaction.type, error: error.message });
            }
        }

        res.json({
            success: true,
            message: 'Batch interactions recorded',
            results,
            processed: results.length
        });
    } catch (error) {
        console.error('Error recording batch interactions:', error);
        res.status(500).json({ error: 'Failed to record batch interactions' });
    }
};
