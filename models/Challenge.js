import { pool } from '../config/db.js';

export class Challenge {
    // ============ إنشاء تحدي جديد ============
    static async create(challengeData) {
        const { title, title_ar, description, description_ar, type, start_date, end_date } = challengeData;

        const [result] = await pool.execute(
            `INSERT INTO challenges (title, title_ar, description, description_ar, type, start_date, end_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
            [title, title_ar, description, description_ar, type, start_date, end_date]
        );

        return result.insertId;
    }

    // ============ الحصول على التحديات النشطة ============
    static async getActiveChallenges() {
        try {
            const [rows] = await pool.execute(
                `SELECT c.*, 
                COUNT(DISTINCT ce.id) as entries_count,
                u.username as winner_username,
                u.avatar as winner_avatar
         FROM challenges c
         LEFT JOIN challenge_entries ce ON c.id = ce.challenge_id
         LEFT JOIN users u ON c.winner_id = u.id
         WHERE c.status = 'active' AND c.end_date > NOW()
         GROUP BY c.id
         ORDER BY c.created_at DESC`
            );
            return rows;
        } catch (error) {
            console.error('Error in Challenge.getActiveChallenges:', error);
            return [];
        }
    }

    // ============ الحصول على التحديات المنتهية ============
    static async getPastChallenges(limit = 10) {
        try {
            const [rows] = await pool.execute(
                `SELECT c.*, 
                COUNT(DISTINCT ce.id) as entries_count,
                u.username as winner_username,
                u.avatar as winner_avatar,
                ub.badge_type
         FROM challenges c
         LEFT JOIN challenge_entries ce ON c.id = ce.challenge_id
         LEFT JOIN users u ON c.winner_id = u.id
         LEFT JOIN user_badges ub ON c.id = ub.challenge_id
         WHERE c.status = 'ended' AND c.winner_id IS NOT NULL
         GROUP BY c.id
         ORDER BY c.winner_announced_at DESC
         LIMIT ?`,
                [limit]
            );
            return rows;
        } catch (error) {
            console.error('Error in Challenge.getPastChallenges:', error);
            return [];
        }
    }

    // ============ الحصول على تحدي بالمعرف ============
    static async findById(id) {
        try {
            const [rows] = await pool.execute(
                `SELECT c.*, 
                COUNT(DISTINCT ce.id) as entries_count,
                u.username as winner_username,
                u.avatar as winner_avatar
         FROM challenges c
         LEFT JOIN challenge_entries ce ON c.id = ce.challenge_id
         LEFT JOIN users u ON c.winner_id = u.id
         WHERE c.id = ?
         GROUP BY c.id`,
                [id]
            );
            return rows[0];
        } catch (error) {
            console.error('Error in Challenge.findById:', error);
            return null;
        }
    }

    // ============ إضافة مشاركة في التحدي ============
    static async submitEntry(entryData) {
        const { challenge_id, user_id, video_id, comment_id } = entryData;

        try {
            // التحقق من عدم وجود مشاركة سابقة
            const [existing] = await pool.execute(
                'SELECT id FROM challenge_entries WHERE challenge_id = ? AND user_id = ?',
                [challenge_id, user_id]
            );

            if (existing.length > 0) {
                return { success: false, message: 'Already submitted to this challenge' };
            }

            // إضافة المشاركة
            const [result] = await pool.execute(
                `INSERT INTO challenge_entries (challenge_id, user_id, video_id, comment_id) 
         VALUES (?, ?, ?, ?)`,
                [challenge_id, user_id, video_id || null, comment_id || null]
            );

            return { success: true, entryId: result.insertId };
        } catch (error) {
            console.error('Error in Challenge.submitEntry:', error);
            return { success: false, message: error.message };
        }
    }

    // ============ الحصول على مشاركات التحدي ============
    static async getEntries(challengeId, limit = 50) {
        try {
            const [rows] = await pool.execute(
                `SELECT ce.*, 
                u.username, u.avatar,
                v.path as video_path, v.thumbnail, v.description as video_description,
                v.views, v.likes as video_likes, v.shares,
                c.content as comment_content,
                (SELECT COUNT(*) FROM comment_likes WHERE comment_id = ce.comment_id) as comment_likes
         FROM challenge_entries ce
         JOIN users u ON ce.user_id = u.id
         LEFT JOIN videos v ON ce.video_id = v.id
         LEFT JOIN comments c ON ce.comment_id = c.id
         WHERE ce.challenge_id = ?
         ORDER BY ce.engagement_score DESC, ce.submission_date ASC
         LIMIT ?`,
                [challengeId, limit]
            );
            return rows;
        } catch (error) {
            console.error('Error in Challenge.getEntries:', error);
            return [];
        }
    }

    // ============ حساب نقاط التفاعل ============
    static async calculateEngagementScore(entryId) {
        try {
            const [entry] = await pool.execute(
                'SELECT video_id, comment_id FROM challenge_entries WHERE id = ?',
                [entryId]
            );

            if (!entry[0]) return 0;

            let score = 0;

            // إذا كانت مشاركة فيديو
            if (entry[0].video_id) {
                const [video] = await pool.execute(
                    'SELECT views, likes, shares FROM videos WHERE id = ?',
                    [entry[0].video_id]
                );

                if (video[0]) {
                    // معادلة النقاط: (إعجابات × 3) + (مشاهدات × 1) + (مشاركات × 5)
                    score = (video[0].likes * 3) + (video[0].views * 1) + (video[0].shares * 5);
                }
            }

            // إذا كانت مشاركة تعليق
            if (entry[0].comment_id) {
                const [likes] = await pool.execute(
                    'SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?',
                    [entry[0].comment_id]
                );

                if (likes[0]) {
                    // نقاط التعليق: عدد الإعجابات × 10
                    score = likes[0].count * 10;
                }
            }

            // تحديث النقاط في قاعدة البيانات
            await pool.execute(
                'UPDATE challenge_entries SET engagement_score = ? WHERE id = ?',
                [score, entryId]
            );

            return score;
        } catch (error) {
            console.error('Error in Challenge.calculateEngagementScore:', error);
            return 0;
        }
    }

    // ============ اختيار الفائز ============
    static async selectWinner(challengeId) {
        try {
            // الحصول على التحدي
            const challenge = await this.findById(challengeId);
            if (!challenge || challenge.status !== 'active') {
                return { success: false, message: 'Challenge not active' };
            }

            // تحديث نقاط جميع المشاركات
            const entries = await this.getEntries(challengeId, 1000);
            for (const entry of entries) {
                await this.calculateEngagementScore(entry.id);
            }

            // اختيار الفائز (أعلى نقاط)
            const [winner] = await pool.execute(
                `SELECT ce.*, u.username, u.avatar
         FROM challenge_entries ce
         JOIN users u ON ce.user_id = u.id
         WHERE ce.challenge_id = ?
         ORDER BY ce.engagement_score DESC
         LIMIT 1`,
                [challengeId]
            );

            if (winner.length === 0) {
                return { success: false, message: 'No entries found' };
            }

            // تحديث التحدي بالفائز
            await pool.execute(
                `UPDATE challenges 
         SET winner_id = ?, winner_announced_at = NOW(), status = 'ended' 
         WHERE id = ?`,
                [winner[0].user_id, challengeId]
            );

            // منح الوسام للفائز
            const badgeType = this.getBadgeType(challenge.type);
            await pool.execute(
                'INSERT INTO user_badges (user_id, badge_type, challenge_id) VALUES (?, ?, ?)',
                [winner[0].user_id, badgeType, challengeId]
            );

            return {
                success: true,
                winner: {
                    userId: winner[0].user_id,
                    username: winner[0].username,
                    avatar: winner[0].avatar,
                    score: winner[0].engagement_score
                }
            };
        } catch (error) {
            console.error('Error in Challenge.selectWinner:', error);
            return { success: false, message: error.message };
        }
    }

    // ============ تحديد نوع الوسام ============
    static getBadgeType(challengeType) {
        const badgeMap = {
            '10_second_video': '10_second_winner',
            'best_editing': 'editing_winner',
            'best_comment': 'comment_winner'
        };
        return badgeMap[challengeType] || '10_second_winner';
    }

    // ============ إنشاء تحديات أسبوعية تلقائياً ============
    static async createWeeklyChallenges() {
        try {
            const now = new Date();
            const monday = new Date(now);
            monday.setDate(now.getDate() - now.getDay() + 1); // الاثنين القادم
            monday.setHours(0, 0, 0, 0);

            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6); // الأحد
            sunday.setHours(23, 59, 59, 999);

            const challenges = [
                {
                    title: 'Best 10-Second Video',
                    title_ar: 'أفضل فيديو 10 ثواني',
                    description: 'Create the most engaging video under 10 seconds!',
                    description_ar: 'أنشئ أكثر فيديو جذاباً في أقل من 10 ثواني!',
                    type: '10_second_video',
                    start_date: monday,
                    end_date: sunday
                },
                {
                    title: 'Best Editing',
                    title_ar: 'أفضل مونتاج',
                    description: 'Show off your editing skills with the best montage!',
                    description_ar: 'أظهر مهاراتك في المونتاج بأفضل عمل!',
                    type: 'best_editing',
                    start_date: monday,
                    end_date: sunday
                },
                {
                    title: 'Best Comment',
                    title_ar: 'أفضل تعليق',
                    description: 'Write the most liked comment of the week!',
                    description_ar: 'اكتب أكثر تعليق يحصل على إعجابات هذا الأسبوع!',
                    type: 'best_comment',
                    start_date: monday,
                    end_date: sunday
                }
            ];

            const createdChallenges = [];
            for (const challenge of challenges) {
                const id = await this.create(challenge);
                createdChallenges.push({ id, ...challenge });
            }

            console.log('✅ Weekly challenges created:', createdChallenges.length);
            return createdChallenges;
        } catch (error) {
            console.error('Error in Challenge.createWeeklyChallenges:', error);
            return [];
        }
    }

    // ============ إنهاء التحديات المنتهية ============
    static async endExpiredChallenges() {
        try {
            // الحصول على التحديات المنتهية
            const [expired] = await pool.execute(
                `SELECT id FROM challenges 
         WHERE status = 'active' AND end_date < NOW()`
            );

            const results = [];
            for (const challenge of expired) {
                const result = await this.selectWinner(challenge.id);
                results.push({ challengeId: challenge.id, ...result });
            }

            console.log('✅ Expired challenges processed:', results.length);
            return results;
        } catch (error) {
            console.error('Error in Challenge.endExpiredChallenges:', error);
            return [];
        }
    }

    // ============ التحقق من مشاركة المستخدم ============
    static async hasUserSubmitted(challengeId, userId) {
        try {
            const [rows] = await pool.execute(
                'SELECT id FROM challenge_entries WHERE challenge_id = ? AND user_id = ?',
                [challengeId, userId]
            );
            return rows.length > 0;
        } catch (error) {
            console.error('Error in Challenge.hasUserSubmitted:', error);
            return false;
        }
    }

    // ============ الحصول على أوسمة المستخدم ============
    static async getUserBadges(userId) {
        try {
            const [rows] = await pool.execute(
                `SELECT ub.*, c.title, c.title_ar, c.type
         FROM user_badges ub
         JOIN challenges c ON ub.challenge_id = c.id
         WHERE ub.user_id = ?
         ORDER BY ub.awarded_at DESC`,
                [userId]
            );
            return rows;
        } catch (error) {
            console.error('Error in Challenge.getUserBadges:', error);
            return [];
        }
    }
}
