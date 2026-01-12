import { pool } from '../config/db.js';
import { User } from '../models/User.js';

async function resetUsers() {
    try {
        console.log('🔄 Starting dynamic user reset process...');

        // 0. Disable foreign key checks
        console.log('🛑 Disabling foreign key checks...');
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');

        // 1. Get all tables
        const [tables] = await pool.query('SHOW TABLES');
        const dbName = process.env.DB_NAME;
        const tableField = `Tables_in_${dbName}`;

        console.log(`🗑️ Clearing all ${tables.length} tables...`);

        for (const row of tables) {
            const tableName = row[tableField];
            if (!tableName) continue;

            try {
                await pool.query(`DELETE FROM ${tableName}`);
                console.log(`✅ Table ${tableName} cleared.`);
            } catch (err) {
                console.warn(`⚠️ Could not clear table ${tableName}:`, err.message);
            }
        }

        // 2. Create Default User
        console.log('👤 Creating default user: hassan@gmail.com');
        // We use pool.execute directly to bypass any model logic if it's broken
        await pool.execute(
            `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
            ['hassan', 'hassan@gmail.com', 'hhaall112233$', 'user']
        );
        console.log('✅ User created.');

        // 3. Create Admin User
        console.log('👑 Creating admin user: admin@admin.com');
        await pool.execute(
            `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
            ['admin', 'admin@admin.com', 'hhaall112233$', 'admin']
        );
        console.log('✅ Admin created.');

        // 4. Re-enable foreign key checks
        console.log('🛡️ Re-enabling foreign key checks...');
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('🚀 User reset completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting users:', error);
        try {
            await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (e) { }
        process.exit(1);
    }
}

resetUsers();
