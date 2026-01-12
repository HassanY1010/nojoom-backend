import { pool } from './config/db.js';

async function checkAdminUser() {
    try {
        const [rows] = await pool.execute('SELECT id, email, username, role FROM users');
        console.log('--- User List ---');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAdminUser();
