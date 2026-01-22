import bcrypt from 'bcryptjs';
import { pool } from './config/db.js';

async function migratePasswords() {
    try {
        console.log('🔄 Starting password migration...');
        const [users] = await pool.execute('SELECT id, password FROM users');

        for (const user of users) {
            // Check if password is already a bcrypt hash (starts with $2a$ or $2b$)
            if (user.password && user.password.startsWith('$2')) {
                console.log(`⏩ User ID ${user.id} already has a hashed password. Skipping.`);
                continue;
            }

            console.log(`🔐 Hashing password for user ID: ${user.id}`);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(user.password, salt);

            await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        }

        console.log('✅ Password migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migratePasswords();
