import cron from 'node-cron';
import { Challenge } from '../models/Challenge.js';

export class ChallengeScheduler {
    static init() {
        console.log('🔄 Initializing Challenge Scheduler...');

        // ✅ كل يوم اثنين الساعة 00:00 - إنشاء تحديات أسبوعية جديدة
        cron.schedule('0 0 * * 1', async () => {
            console.log('⏰ Running weekly challenge creation job...');
            try {
                const challenges = await Challenge.createWeeklyChallenges();
                console.log(`✅ Created ${challenges.length} weekly challenges`);
            } catch (error) {
                console.error('❌ Error creating weekly challenges:', error);
            }
        }, {
            timezone: 'Asia/Riyadh' // توقيت السعودية
        });

        // ✅ كل يوم الساعة 01:00 - التحقق من التحديات المنتهية وإعلان الفائزين
        cron.schedule('0 1 * * *', async () => {
            console.log('⏰ Running expired challenges check job...');
            try {
                const results = await Challenge.endExpiredChallenges();
                console.log(`✅ Processed ${results.length} expired challenges`);

                // إرسال إشعارات للفائزين (يمكن إضافة نظام إشعارات لاحقاً)
                for (const result of results) {
                    if (result.success && result.winner) {
                        console.log(`🏆 Winner announced for challenge ${result.challengeId}: ${result.winner.username}`);
                    }
                }
            } catch (error) {
                console.error('❌ Error processing expired challenges:', error);
            }
        }, {
            timezone: 'Asia/Riyadh'
        });

        // ✅ كل 6 ساعات - تحديث نقاط التفاعل لجميع المشاركات النشطة
        cron.schedule('0 */6 * * *', async () => {
            console.log('⏰ Running engagement score update job...');
            try {
                const activeChallenges = await Challenge.getActiveChallenges();

                for (const challenge of activeChallenges) {
                    const entries = await Challenge.getEntries(challenge.id, 1000);

                    for (const entry of entries) {
                        await Challenge.calculateEngagementScore(entry.id);
                    }

                    console.log(`✅ Updated scores for ${entries.length} entries in challenge ${challenge.id}`);
                }
            } catch (error) {
                console.error('❌ Error updating engagement scores:', error);
            }
        }, {
            timezone: 'Asia/Riyadh'
        });

        console.log('✅ Challenge Scheduler initialized successfully');
        console.log('📅 Schedule:');
        console.log('   - Weekly challenges: Every Monday at 00:00');
        console.log('   - Winner selection: Daily at 01:00');
        console.log('   - Score updates: Every 6 hours');
    }

    // ✅ دالة لإنشاء التحديات يدوياً (للاختبار)
    static async createChallengesNow() {
        try {
            console.log('🔄 Creating challenges manually...');
            const challenges = await Challenge.createWeeklyChallenges();
            console.log(`✅ Created ${challenges.length} challenges`);
            return challenges;
        } catch (error) {
            console.error('❌ Error creating challenges manually:', error);
            throw error;
        }
    }

    // ✅ دالة لإنهاء التحديات يدوياً (للاختبار)
    static async endChallengesNow() {
        try {
            console.log('🔄 Ending expired challenges manually...');
            const results = await Challenge.endExpiredChallenges();
            console.log(`✅ Processed ${results.length} challenges`);
            return results;
        } catch (error) {
            console.error('❌ Error ending challenges manually:', error);
            throw error;
        }
    }
}
