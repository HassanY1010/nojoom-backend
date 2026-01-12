
import { pool } from './config/db.js';

async function checkTables() {
    console.log('🔍 Checking database tables...');

    const tablesToCheck = ['follows', 'followers', 'video_views', 'watch_history', 'likes', 'comments'];

    for (const table of tablesToCheck) {
        try {
            await pool.execute(`SELECT 1 FROM ${table} LIMIT 1`);
            console.log(`✅ Table '${table}' exists.`);
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                console.log(`❌ Table '${table}' DOES NOT exist.`);
            } else {
                console.log(`⚠️ Error checking '${table}':`, error.message);
            }
        }
    }
    process.exit();
}

checkTables();
