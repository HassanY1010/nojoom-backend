import { Challenge } from '../models/Challenge.js';

export const challengeController = {
    // ============ الحصول على التحديات النشطة ============
    async getActiveChallenges(req, res) {
        try {
            const challenges = await Challenge.getActiveChallenges();

            // إضافة معلومات مشاركة المستخدم إذا كان مسجل دخول
            if (req.user) {
                for (const challenge of challenges) {
                    challenge.user_submitted = await Challenge.hasUserSubmitted(challenge.id, req.user.id);
                }
            }

            res.json({
                success: true,
                data: challenges
            });
        } catch (error) {
            console.error('Get active challenges error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get active challenges'
            });
        }
    },

    // ============ الحصول على التحديات السابقة ============
    async getPastChallenges(req, res) {
        try {
            const { limit = 10 } = req.query;
            const challenges = await Challenge.getPastChallenges(parseInt(limit));

            res.json({
                success: true,
                data: challenges
            });
        } catch (error) {
            console.error('Get past challenges error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get past challenges'
            });
        }
    },

    // ============ الحصول على تفاصيل تحدي ============
    async getChallengeById(req, res) {
        try {
            const { id } = req.params;
            const challenge = await Challenge.findById(id);

            if (!challenge) {
                return res.status(404).json({
                    success: false,
                    message: 'Challenge not found'
                });
            }

            // إضافة معلومات مشاركة المستخدم
            if (req.user) {
                challenge.user_submitted = await Challenge.hasUserSubmitted(challenge.id, req.user.id);
            }

            res.json({
                success: true,
                data: challenge
            });
        } catch (error) {
            console.error('Get challenge by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get challenge'
            });
        }
    },

    // ============ إضافة مشاركة في التحدي ============
    async submitEntry(req, res) {
        try {
            const { id } = req.params;
            const { video_id, comment_id } = req.body;
            const userId = req.user.id;

            // التحقق من وجود التحدي
            const challenge = await Challenge.findById(id);
            if (!challenge) {
                return res.status(404).json({
                    success: false,
                    message: 'Challenge not found'
                });
            }

            // التحقق من أن التحدي نشط
            if (challenge.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    message: 'Challenge is not active'
                });
            }

            // التحقق من أن التحدي لم ينته
            if (new Date(challenge.end_date) < new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'Challenge has ended'
                });
            }

            // التحقق من نوع المشاركة
            if (challenge.type === 'best_comment' && !comment_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Comment ID is required for comment challenges'
                });
            }

            if ((challenge.type === '10_second_video' || challenge.type === 'best_editing') && !video_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Video ID is required for video challenges'
                });
            }

            // إضافة المشاركة
            const result = await Challenge.submitEntry({
                challenge_id: id,
                user_id: userId,
                video_id,
                comment_id
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                message: 'Entry submitted successfully',
                data: { entryId: result.entryId }
            });
        } catch (error) {
            console.error('Submit entry error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to submit entry'
            });
        }
    },

    // ============ الحصول على مشاركات التحدي ============
    async getChallengeEntries(req, res) {
        try {
            const { id } = req.params;
            const { limit = 50 } = req.query;

            const entries = await Challenge.getEntries(id, parseInt(limit));

            res.json({
                success: true,
                data: entries
            });
        } catch (error) {
            console.error('Get challenge entries error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get challenge entries'
            });
        }
    },

    // ============ الحصول على أوسمة المستخدم ============
    async getUserBadges(req, res) {
        try {
            const userId = req.user.id;
            const badges = await Challenge.getUserBadges(userId);

            res.json({
                success: true,
                data: badges
            });
        } catch (error) {
            console.error('Get user badges error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user badges'
            });
        }
    },

    // ============ إنشاء تحديات أسبوعية (Admin فقط) ============
    async createWeeklyChallenges(req, res) {
        try {
            // التحقق من صلاحيات المدير
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const challenges = await Challenge.createWeeklyChallenges();

            res.json({
                success: true,
                message: 'Weekly challenges created successfully',
                data: challenges
            });
        } catch (error) {
            console.error('Create weekly challenges error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create weekly challenges'
            });
        }
    },

    // ============ إنهاء التحديات المنتهية (Admin فقط) ============
    async endExpiredChallenges(req, res) {
        try {
            // التحقق من صلاحيات المدير
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const results = await Challenge.endExpiredChallenges();

            res.json({
                success: true,
                message: 'Expired challenges processed successfully',
                data: results
            });
        } catch (error) {
            console.error('End expired challenges error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to end expired challenges'
            });
        }
    }
};
