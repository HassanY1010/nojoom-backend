const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function importDb() {
    console.log('🔄 Starting database import to Aiven...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        ssl: {
            ca: fs.readFileSync(path.join(__dirname, 'ca.pem')),
        },
        multipleStatements: true
    });

    try {
        const sql = fs.readFileSync(path.join(__dirname, 'database_schema.sql'), 'utf8');
        // We need to clean the SQL a bit because exports might contain things Aiven doesn't like 
        // or specific local settings. But usually mysqldump standard is fine.

        console.log('📤 Uploading schema...');
        await connection.query(sql);
        console.log('✅ Database imported successfully to Aiven!');
    } catch (err) {
        console.error('❌ Import failed:', err.message);
    } finally {
        await connection.end();
    }
}

importDb();
