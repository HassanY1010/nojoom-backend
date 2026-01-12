const mysqldump = require('mysqldump');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function exportDb() {
    console.log('🔄 Starting database export...');
    try {
        await mysqldump({
            connection: {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'nojoom',
            },
            dumpToFile: './database_schema.sql',
        });
        console.log('✅ Database exported successfully to database_schema.sql');
    } catch (err) {
        console.error('❌ Export failed:', err.message);
        process.exit(1);
    }
}

exportDb();
