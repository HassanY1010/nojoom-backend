// config/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  console.error("❌ Missing required database environment variables");
  process.exit(1);
}

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 50, // ✅ تم الرفع لزيادة السرعة والتعامل مع ضغط المستخدمين
  queueLimit: 0
};

export const pool = mysql.createPool(dbConfig);

// دالة تنفيذ الاستعلامات للإستخدام في الكونترولر
export const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const initializeDatabase = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database');

    // ✅ تحديث جدول المستخدمين
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(255) DEFAULT '/uploads/avatars/default-avatar.png',
        bio TEXT,
        social_links JSON,
        role ENUM('user', 'admin') DEFAULT 'user',
        email_verified BOOLEAN DEFAULT FALSE,
        language ENUM('en', 'ar') DEFAULT 'en',
        theme ENUM('light', 'dark') DEFAULT 'dark',
        followers_count INT DEFAULT 0,
        following_count INT DEFAULT 0,
        likes_count INT DEFAULT 0,
        views_count INT DEFAULT 0,
        total_watch_time INT DEFAULT 0,
        birth_date DATE,
        birth_day INT,
        birth_month INT,
        birth_year INT,
        is_banned BOOLEAN DEFAULT FALSE,
        ban_reason TEXT,
        deleted_by_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_is_banned (is_banned)
      )
    `);

    // ✅ أعمدة إضافية مع EXISTS لتجنب errors إذا كانت موجودة
    const addCol = async (colDef) => {
      try {
        await connection.execute(colDef);
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
        console.log(`⚠️ Column already exists`);
      }
    };

    await addCol(`ALTER TABLE users ADD COLUMN is_private BOOLEAN DEFAULT FALSE`);
    await addCol(`ALTER TABLE users ADD COLUMN allow_dms BOOLEAN DEFAULT TRUE`);
    await addCol(`ALTER TABLE users ADD COLUMN show_activity_status BOOLEAN DEFAULT TRUE`);
    await addCol(`ALTER TABLE users ADD COLUMN otp_code VARCHAR(6)`);
    await addCol(`ALTER TABLE users ADD COLUMN otp_expires TIMESTAMP NULL`);

    // ✅ إنشاء جدول reset_codes لإعادة تعيين كلمة المرور
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reset_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_code (code),
        INDEX idx_expires_at (expires_at)
      )
    `);

    // إنشاء جدول لتخزين توكنات التحقق من البريد الإلكتروني
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول البث الإداري
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_created_at (created_at)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS broadcast_displays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        broadcast_id INT NOT NULL,
        user_id INT NOT NULL,
        display_count INT DEFAULT 1,
        displayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_broadcast_user (broadcast_id, user_id),
        INDEX idx_broadcast_id (broadcast_id)
      )
    `);

    // ✅ تحديث جدول الفيديوهات بشكل كامل
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        path VARCHAR(255) NOT NULL,
        description TEXT,
        hashtags JSON,
        is_public BOOLEAN DEFAULT TRUE,
        is_chat_video BOOLEAN DEFAULT FALSE,
        views INT DEFAULT 0,
        likes INT DEFAULT 0,
        duration INT DEFAULT 0,
        deleted_by_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_public (is_public),
        INDEX idx_created_at (created_at),
        INDEX idx_deleted_by_admin (deleted_by_admin)
      )
    `);

    // ✅ إضافة أعمدة إضافية للفيديوهات
    await addCol(`ALTER TABLE videos ADD COLUMN shares INT DEFAULT 0`);
    await addCol(`ALTER TABLE videos ADD COLUMN thumbnail VARCHAR(255)`);
    await addCol(`ALTER TABLE videos ADD COLUMN title VARCHAR(255) DEFAULT 'بدون عنوان'`);
    await addCol(`ALTER TABLE videos ADD COLUMN video_url VARCHAR(255)`);
    await addCol(`ALTER TABLE videos ADD COLUMN url VARCHAR(255)`);
    await addCol(`ALTER TABLE videos ADD COLUMN subspace_video_id VARCHAR(255)`);
    await addCol(`ALTER TABLE videos ADD COLUMN subspace_thumbnail_id VARCHAR(255)`);
    await addCol(`ALTER TABLE videos ADD COLUMN pinned_at TIMESTAMP NULL`);
    await addCol(`ALTER TABLE videos ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE`);
    await addCol(`ALTER TABLE videos ADD COLUMN deletion_reason TEXT`);
    await addCol(`ALTER TABLE videos ADD COLUMN deleted_at TIMESTAMP NULL`);

    // ✅ جدول الرسائل الخاصة (Direct Messages)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_sender_id (sender_id),
        INDEX idx_receiver_id (receiver_id),
        INDEX idx_created_at (created_at),
        INDEX idx_is_read (is_read)
      )
    `);

    // ✅ إنشاء جدول المحادثات النشطة
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS active_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user1_id INT NOT NULL,
        user2_id INT NOT NULL,
        last_message_id INT,
        last_message_content TEXT,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unread_count INT DEFAULT 0,
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (last_message_id) REFERENCES direct_messages(id) ON DELETE SET NULL,
        UNIQUE KEY unique_conversation (user1_id, user2_id),
        INDEX idx_user1_id (user1_id),
        INDEX idx_user2_id (user2_id),
        INDEX idx_last_message_at (last_message_at)
      )
    `);

    // ✅ جدول مشاهدات الفيديو
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS video_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        video_id INT NOT NULL,
        source VARCHAR(50) DEFAULT 'explore',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_video_id (video_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول مشاهدات الـ Explore
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS explore_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        video_id INT NOT NULL,
        source VARCHAR(50) DEFAULT 'explore',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول المتابعات
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS follows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        follower_id INT NOT NULL,
        following_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_follow (follower_id, following_id),
        INDEX idx_follower_id (follower_id),
        INDEX idx_following_id (following_id)
      )
    `);

    // ✅ جدول الإعجابات
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        UNIQUE KEY unique_like (user_id, video_id),
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id)
      )
    `);

    // ✅ جدول التعليقات
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_video_id (video_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول الرسائل (للفيديو/الشات العام)
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

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS message_displays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        display_count INT DEFAULT 1,
        displayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_message_user (message_id, user_id),
        INDEX idx_message_id (message_id),
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول سجل المشاهدة
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS watch_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        watch_time INT DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_video (user_id, video_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ إضافة عمود last_position لسجل المشاهدة
    await addCol(`ALTER TABLE watch_history ADD COLUMN last_position DECIMAL(10,2) DEFAULT 0`);

    // ✅ جدول تفاعلات المستخدم
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_interactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT,
        interaction_type ENUM('like', 'share', 'watch_complete', 'watch_partial', 'follow', 'comment', 'report', 'view') NOT NULL,
        weight DECIMAL(3,2) DEFAULT 1.0,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول refresh tokens
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token)
      )
    `);

    // ✅ جدول سجل البحث
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        query VARCHAR(255) NOT NULL,
        search_type VARCHAR(50) DEFAULT 'all',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول تفاعلات البحث
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS search_interactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT,
        interaction_type VARCHAR(50) NOT NULL,
        weight DECIMAL(3,2) DEFAULT 1.0,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id)
      )
    `);

    // ✅ جدول تتبع حركة العين (Eye Tracking)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS eye_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        gaze_points JSON,
        attention_score DECIMAL(5,2) DEFAULT 0,
        focus_duration INT DEFAULT 0,
        viewport_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_video (user_id, video_id),
        INDEX idx_created_at (created_at),
        INDEX idx_attention_score (attention_score)
      )
    `);

    // ✅ جدول تتبع سلوك التمرير (Scroll Behavior)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS scroll_behavior (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        scroll_speed DECIMAL(8,2) DEFAULT 0,
        scroll_pattern VARCHAR(50),
        pause_duration INT DEFAULT 0,
        engagement_score DECIMAL(5,2) DEFAULT 0,
        swipe_direction VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول التفاعل الصوتي (Voice Interactions)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS voice_interactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        interaction_type VARCHAR(50) DEFAULT 'reaction',
        duration INT DEFAULT 0,
        intensity DECIMAL(5,2) DEFAULT 0,
        timestamp_in_video INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول ملفات المستخدم AI (AI User Profiles)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_user_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        eye_tracking_enabled BOOLEAN DEFAULT FALSE,
        voice_tracking_enabled BOOLEAN DEFAULT FALSE,
        scroll_tracking_enabled BOOLEAN DEFAULT TRUE,
        profile_data JSON,
        preferences JSON,
        total_ai_score DECIMAL(8,2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول بيانات التدريب AI (AI Training Data)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_training_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        interaction_data JSON,
        prediction_score DECIMAL(5,2),
        actual_engagement DECIMAL(5,2),
        accuracy DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول أجزاء الفيديو (Video Chunks) - للمحرك الفائق
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS video_chunks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        quality ENUM('360p', '480p', '720p') NOT NULL,
        chunk_index INT NOT NULL,
        chunk_path VARCHAR(255) NOT NULL,
        duration DECIMAL(5,2),
        file_size INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_video_quality (video_id, quality),
        INDEX idx_chunk_index (chunk_index)
      )
    `);

    // ✅ جدول ملفات Manifest للفيديو (HLS)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS video_manifests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        manifest_path VARCHAR(255) NOT NULL,
        total_chunks INT DEFAULT 0,
        processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        UNIQUE KEY unique_video (video_id),
        INDEX idx_processing_status (processing_status)
      )
    `);

    // ✅ جدول التحديات الأسبوعية (Weekly Challenges)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS challenges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        title_ar VARCHAR(255) NOT NULL,
        description TEXT,
        description_ar TEXT,
        type ENUM('10_second_video', 'best_editing', 'best_comment') NOT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        status ENUM('active', 'ended', 'archived') DEFAULT 'active',
        winner_id INT,
        winner_announced_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_type (type),
        INDEX idx_dates (start_date, end_date)
      )
    `);

    // ✅ جدول مشاركات التحديات (Challenge Entries)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS challenge_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        challenge_id INT NOT NULL,
        user_id INT NOT NULL,
        video_id INT,
        comment_id INT,
        engagement_score DECIMAL(10,2) DEFAULT 0,
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_challenge (user_id, challenge_id),
        INDEX idx_challenge_id (challenge_id),
        INDEX idx_user_id (user_id),
        INDEX idx_engagement_score (engagement_score)
      )
    `);

    // ✅ جدول أوسمة المستخدمين (User Badges)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        badge_type ENUM('10_second_winner', 'editing_winner', 'comment_winner') NOT NULL,
        challenge_id INT NOT NULL,
        awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_badge_type (badge_type)
      )
    `);

    // ✅ جدول الرسائل المتحركة (Animated Messages)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS animated_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        animation_type ENUM('fade', 'slide', 'bounce', 'glow') DEFAULT 'fade',
        color VARCHAR(50) DEFAULT '#FFD700',
        is_active BOOLEAN DEFAULT TRUE,
        views_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NULL,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_sender_id (sender_id),
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول مشاركات الفيديو (Video Shares)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS video_shares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        user_id INT NOT NULL,
        share_method VARCHAR(50) DEFAULT 'direct',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_video_id (video_id),
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول إعدادات النظام
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY DEFAULT 1,
        maintenance_mode BOOLEAN DEFAULT FALSE,
        chat_enabled BOOLEAN DEFAULT TRUE,
        upload_enabled BOOLEAN DEFAULT TRUE,
        user_registration_enabled BOOLEAN DEFAULT TRUE,
        max_video_size BIGINT DEFAULT 104857600,
        max_video_duration INT DEFAULT 300,
        auto_ban_reports_threshold INT DEFAULT 5,
        allowed_video_formats VARCHAR(255) DEFAULT 'mp4,mov,avi',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // التأكد من وجود الأعمدة الجديدة
    await addCol(`ALTER TABLE system_settings ADD COLUMN user_registration_enabled BOOLEAN DEFAULT TRUE`);
    await addCol(`ALTER TABLE system_settings ADD COLUMN auto_ban_reports_threshold INT DEFAULT 5`);

    console.log('✅ All tables ready');
  } catch (error) {
    console.error('❌ DB init error:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export default { pool, executeQuery, initializeDatabase };