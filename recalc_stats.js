
import { pool } from './config/db.js';

async function recalculateStats() {
    console.log('🔄 Starting user stats recalculation...');

    try {
        const [users] = await pool.execute('SELECT id, username FROM users');

        for (const user of users) {
            const userId = user.id;

            // 1. Followers Count
            const [followersResult] = await pool.execute(
                'SELECT COUNT(*) as count FROM followers WHERE following_id = ?',
                [userId]
            );
            const followersCount = followersResult[0].count;

            // 2. Following Count
            const [followingResult] = await pool.execute(
                'SELECT COUNT(*) as count FROM followers WHERE follower_id = ?',
                [userId]
            );
            const followingCount = followingResult[0].count;

            // 3. Videos Count (Not stored in users, but good to check)
            // We don't store video_count in users table usually, but we check if we should. 
            // The user schema has: followers_count, following_count, likes_count, views_count, total_watch_time.

            // 4. Likes Count (Total likes received on videos)
            const [likesResult] = await pool.execute(
                `SELECT COUNT(l.user_id) as count 
         FROM likes l
         JOIN videos v ON l.video_id = v.id
         WHERE v.user_id = ? AND v.deleted_by_admin = FALSE`,
                [userId]
            );
            const likesCount = likesResult[0].count;

            // 5. Views Count (Total views on videos)
            const [viewsResult] = await pool.execute(
                `SELECT COALESCE(SUM(views), 0) as count 
         FROM videos 
         WHERE user_id = ? AND deleted_by_admin = FALSE`,
                [userId]
            );
            const viewsCount = viewsResult[0].count;

            // Update User
            await pool.execute(
                `UPDATE users 
         SET followers_count = ?, 
             following_count = ?, 
             likes_count = ?, 
             views_count = ? 
         WHERE id = ?`,
                [followersCount, followingCount, likesCount, viewsCount, userId]
            );

            console.log(`✅ Updated stats for ${user.username}: Followers=${followersCount}, Following=${followingCount}, Likes=${likesCount}, Views=${viewsCount}`);
        }

        console.log('🎉 Recalculation complete!');
    } catch (error) {
        console.error('❌ Error recalculating stats:', error);
    } finally {
        process.exit();
    }
}

recalculateStats();
