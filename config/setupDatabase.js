import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// التأكد من وجود المتغيرات البيئية
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  console.error("❌ Missing required database environment variables");
  process.exit(1);
}

// إعداد الاتصال بقاعدة البيانات
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// دالة لإنشاء الجداول
export const initializeDatabase = async () => {
  try {
    // إنشاء الاتصال باستخدام الـ pool مباشرة
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database');

    // إنشاء جدول المستخدمين
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(255) DEFAULT '/uploads/avatar.png',
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // إنشاء جدول الفيديوهات
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        path VARCHAR(255) NOT NULL,
        description TEXT,
        is_chat_video BOOLEAN DEFAULT FALSE,
        views INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // إنشاء جدول الرسائل
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT,
        video_id INT,
        content TEXT NOT NULL,
        type ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
      )
    `);

    // إغلاق الاتصال بعد إنشاء الجداول
    connection.release();
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};
