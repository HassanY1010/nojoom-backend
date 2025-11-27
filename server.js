import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Import routes
import { initializeDatabase } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import * as authController from './controllers/authController.js';
import videoRoutes from './routes/videoRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import tokenRoutes from './routes/tokenRoutes.js';
import exploreRoutes from './routes/exploreRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import resetPasswordRoutes from "./routes/resetPasswordRoutes.js";
import usersRoutes from './routes/usersRoutes.js';
import messagesRoutes from './routes/messagesRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import challengeRoutes from './routes/challengeRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

// Socket.io
import { initSocket } from './socket/socketManager.js';

// Challenge Scheduler
import { ChallengeScheduler } from './services/challengeScheduler.js';

// Middleware for auth
import { authenticateToken } from './middleware/authMiddleware.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// ==================== Middleware ====================

// Helmet for security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('dev'));

// JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    timestamp: new Date().toISOString()
  }
});

// ==================== CORS Middleware ====================
const allowedOrigins = [
  process.env.CLIENT_URL
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, Refresh-Token, X-API-Key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Total-Pages');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// ==================== Routes ====================
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reset-password', resetPasswordRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/notifications', notificationRoutes);

// ==================== Socket.io ====================
initSocket(server);

// ==================== Database ====================
initializeDatabase();

// ==================== Challenge Scheduler ====================
ChallengeScheduler.init();

// ==================== Start Server ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// ==================== Middlewares ====================

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing with better limits
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: '50mb',
  parameterLimit: 10000
}));

// ==================== Static Files ====================

// ✅ إضافة خدمة ثابتة لملفات thumbnails
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

// ✅ إصلاح: إعداد خدمة الملفات الثابتة بشكل صحيح
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    // إضافة رؤوس التحكم بالكاش للصور
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // تحديد نوع المحتوى بناءً على امتداد الملف
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg'
    };

    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

// ✅ إضافة خدمة ثابتة للملفات الافتراضية
app.use('/default-avatar.png', express.static(path.join(__dirname, 'public', 'default-avatar.png')));
app.use('/default-thumbnail.jpg', express.static(path.join(__dirname, 'public', 'default-thumbnail.jpg')));

// ==================== تهيئة السيرفر ====================

const startServer = async () => {
  try {
    console.log('🔄 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    // إنشاء المجلدات الضرورية
    const directories = [
      'uploads',
      'uploads/videos',
      'uploads/avatars',
      'thumbnails', // ✅ إضافة مجلد thumbnails
      'temp',
      'logs',
      'public' // ✅ إضافة مجلد public للصور الافتراضية
    ];

    for (const dir of directories) {
      const dirPath = path.join(__dirname, dir);
      try {
        await fs.promises.access(dirPath);
      } catch (error) {
        await fs.promises.mkdir(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    }

    // ✅ إنشاء صورة افتراضية إذا لم تكن موجودة
    const defaultAvatarPath = path.join(__dirname, 'public', 'default-avatar.png');
    const defaultThumbnailPath = path.join(__dirname, 'public', 'default-thumbnail.jpg');

    try {
      await fs.promises.access(defaultAvatarPath);
    } catch (error) {
      console.log('ℹ️ Default avatar not found, using fallback');
    }

    try {
      await fs.promises.access(defaultThumbnailPath);
    } catch (error) {
      console.log('ℹ️ Default thumbnail not found, using fallback');
    }
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('='.repeat(70));
  console.log('🚀 NOJOOM SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(70));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Host: ${HOST}`);
  console.log(`📡 URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🛡️ Security: Helmet, Rate Limiting, CORS Enabled`);
  console.log(`📊 Features: Recommendations, Reports, Real-time Chat, Search`);
  console.log(`🖼️ Static Files: Avatars, Videos, Thumbnails, Default Images`);
  console.log('='.repeat(70));
  console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔎 Search: http://localhost:${PORT}/api/search`);
  console.log(`🧪 CORS Test: http://localhost:${PORT}/api/cors-test`);
  console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics`);
  console.log(`🔗 API Docs: http://localhost:${PORT}/api/docs`);
  console.log(`🖼️ Static Files: http://localhost:${PORT}/uploads/`);
  console.log(`🖼️ Thumbnails: http://localhost:${PORT}/thumbnails/`);
  console.log('='.repeat(70));

  // ✅ تهيئة جدولة التحديات الأسبوعية
  ChallengeScheduler.start(); // أو init() إذا كانت موجودة في الكلاس
});


  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ==================== Routes ====================

// Apply auth rate limiting to auth routes
app.use('/api/auth', authLimiter, authRoutes);

// Other routes
app.use('/api/videos', videoRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', commentRoutes);
app.use('/explore', exploreRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/tokens', tokenRoutes);
app.use("/api/reset-password", resetPasswordRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/notifications', notificationRoutes);


app.post('/create-admin', authController.createAdminIfNotExists);

// ==================== Debug Routes ====================

// ✅ إضافة endpoint للتحقق من هيكل الجداول
app.get('/api/debug/tables', async (req, res) => {
  try {
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('videos', 'watch_history', 'users')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    res.json({ tables });
  } catch (error) {
    console.error('Debug tables error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== User Routes ====================

// ✅ إصلاح route سجل المشاهدة مباشرة لحل مشكلة العمود title
app.get('/api/user/watch-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    console.log('🔄 Fetching watch history for user:', userId);

    // أولاً: التحقق من هيكل جدول videos
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'videos'
      `);

      const videoColumns = columns.map(col => col.COLUMN_NAME);
      console.log('📊 Available video columns:', videoColumns);

      // بناء الاستعلام ديناميكياً بناءً على الأعمدة المتاحة
      let titleColumn = 'title';
      let descriptionColumn = 'description';

      // التحقق من وجود الأعمدة
      if (!videoColumns.includes('title')) {
        console.log('⚠️ Column "title" not found, using "video_title" instead');
        titleColumn = 'video_title';
      }

      if (!videoColumns.includes('description')) {
        console.log('⚠️ Column "description" not found, using "video_description" instead');
        descriptionColumn = 'video_description';
      }

      const [history] = await pool.execute(
        `SELECT 
          wh.*,
          v.id as video_id,
          v.${titleColumn} as title,
          v.${descriptionColumn} as description,
          v.url,
          v.thumbnail,
          v.duration,
          v.views,
          v.likes,
          v.created_at as video_created_at,
          u.id as owner_id,
          u.username as owner_username,
          u.avatar as owner_avatar
         FROM watch_history wh
         JOIN videos v ON wh.video_id = v.id
         JOIN users u ON v.user_id = u.id
         WHERE wh.user_id = ?
         ORDER BY wh.updated_at DESC
         LIMIT ? OFFSET ?`,
        [userId, parseInt(limit), offset]
      );

      const [totalCount] = await pool.execute(
        'SELECT COUNT(*) as total FROM watch_history WHERE user_id = ?',
        [userId]
      );

      res.json({
        success: true,
        data: history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount[0].total,
          pages: Math.ceil(totalCount[0].total / limit)
        }
      });

    } catch (dbError) {
      console.error('❌ Database structure error:', dbError);

      // استعلام بديل إذا فشل الأول
      const [simpleHistory] = await pool.execute(
        `SELECT 
          wh.*,
          v.id as video_id,
          v.url,
          u.username as owner_username
         FROM watch_history wh
         JOIN videos v ON wh.video_id = v.id
         JOIN users u ON v.user_id = u.id
         WHERE wh.user_id = ?
         ORDER BY wh.updated_at DESC
         LIMIT ? OFFSET ?`,
        [userId, parseInt(limit), offset]
      );

      res.json({
        success: true,
        data: simpleHistory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: simpleHistory.length,
          pages: 1
        }
      });
    }
  } catch (error) {
    console.error('❌ Get watch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get watch history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ إضافة route لتسجيل مشاهدة الفيديو - تم التصحيح
app.post('/api/user/watch-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { videoId, watchTime = 1, completed = false } = req.body;

    console.log('🔄 Recording watch history:', { userId, videoId, watchTime });

    // التحقق من وجود الفيديو
    const [videos] = await pool.execute(
      'SELECT id FROM videos WHERE id = ?',
      [videoId]
    );

    if (videos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // ✅ التصحيح: استخدام ON DUPLICATE KEY UPDATE بدلاً من INSERT مباشرة
    await pool.execute(
      `INSERT INTO watch_history (user_id, video_id, watch_time, completed) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       watch_time = VALUES(watch_time), 
       completed = VALUES(completed),
       updated_at = CURRENT_TIMESTAMP`,
      [userId, videoId, watchTime, completed]
    );

    // زيادة عدد مشاهدات الفيديو
    await pool.execute(
      'UPDATE videos SET views = COALESCE(views, 0) + 1 WHERE id = ?',
      [videoId]
    );

    res.json({
      success: true,
      message: 'Watch history updated successfully'
    });
  } catch (error) {
    console.error('❌ Update watch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update watch history'
    });
  }
});

// ✅ إضافة route تفضيلات المستخدم مباشرة
app.get('/api/user/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🔄 Getting user preferences for:', userId);

    // محاولة جلب التفضيلات من قاعدة البيانات
    try {
      const [prefs] = await pool.execute(
        'SELECT preferred_categories, content_weights, excluded_users FROM user_preferences WHERE user_id = ?',
        [userId]
      );

      if (prefs.length > 0) {
        const preferences = {
          preferred_categories: JSON.parse(prefs[0].preferred_categories || '[]'),
          content_weights: JSON.parse(prefs[0].content_weights || '{}'),
          excluded_users: JSON.parse(prefs[0].excluded_users || '[]')
        };

        return res.json({
          success: true,
          data: preferences
        });
      }
    } catch (dbError) {
      console.error('Error fetching preferences from DB:', dbError);
      // إذا الجدول غير موجود، نستمر مع التفضيلات الافتراضية
    }

    // إرجاع تفضيلات افتراضية
    const defaultPreferences = {
      preferred_categories: [],
      content_weights: {},
      excluded_users: []
    };

    res.json({
      success: true,
      data: defaultPreferences
    });
  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user preferences'
    });
  }
});

// ✅ إضافة route تحديث تفضيلات المستخدم
app.put('/api/user/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;

    console.log('🔄 Updating user preferences for:', userId, preferences);

    // محاولة حفظ التفضيلات في قاعدة البيانات
    try {
      await pool.execute(
        `INSERT INTO user_preferences (user_id, preferred_categories, content_weights, excluded_users, updated_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         preferred_categories = VALUES(preferred_categories),
         content_weights = VALUES(content_weights),
         excluded_users = VALUES(excluded_users),
         updated_at = NOW()`,
        [
          userId,
          JSON.stringify(preferences?.preferred_categories || []),
          JSON.stringify(preferences?.content_weights || {}),
          JSON.stringify(preferences?.excluded_users || [])
        ]
      );
    } catch (dbError) {
      console.error('Error saving preferences to DB:', dbError);
      // إذا الجدول غير موجود، نستمر بدون حفظ في DB
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: preferences
    });
  } catch (error) {
    console.error('Update user preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
});

// ✅ إضافة route إحصائيات المستخدم
app.get('/api/user/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [stats] = await pool.execute(
      `SELECT 
         followers_count,
         following_count,
         likes_count,
         views_count,
         total_watch_time,
         (SELECT COUNT(*) FROM videos WHERE user_id = ? AND deleted_by_admin = FALSE) as videos_count
       FROM users 
       WHERE id = ?`,
      [userId, userId]
    );

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics'
    });
  }
});

// ==================== API Endpoints ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: 'Nojoom Server is running optimally',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    environment: process.env.NODE_ENV || 'development',
    features: {
      authentication: true,
      videoSharing: true,
      realTimeChat: true,
      adminPanel: true,
      reportingSystem: true,
      recommendations: true,
      userManagement: true,
      security: true,
      search: true,
      staticFiles: true,
      thumbnails: true // ✅ إضافة دعم الـthumbnails
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  };

  res.json(healthCheck);
});

// Metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json({
    metrics: {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      requests: {
        total: req.app.get('requestCount') || 0
      },
      performance: {
        responseTime: 'monitored',
        activeConnections: server._connections || 0
      }
    },
    timestamp: new Date().toISOString()
  });
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Nojoom API Documentation',
    version: '2.1.0',
    description: 'Complete Social Platform API with Recommendations System',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      auth: {
        register: 'POST /auth/register',
        login: 'POST /auth/login',
        refresh: 'POST /auth/refresh',
        logout: 'POST /auth/logout',
        profile: 'GET /auth/profile'
      },
      videos: {
        list: 'GET /videos',
        upload: 'POST /videos/upload',
        get: 'GET /videos/:id',
        like: 'POST /videos/:id/like',
        delete: 'DELETE /videos/:id'
      },
      search: {
        search: 'GET /search',
        hashtags: 'GET /search/hashtags',
        suggestions: 'GET /search/suggestions',
        trending: 'GET /search/trending-hashtags'
      },
      recommendations: {
        personalized: 'GET /recommendations/personalized',
        trending: 'GET /recommendations/trending',
        similar: 'GET /recommendations/similar/:videoId'
      },
      users: {
        search: 'GET /users/search',
        profile: 'GET /users/:id',
        follow: 'POST /users/:id/follow',
        unfollow: 'DELETE /users/:id/follow',
        watchHistory: 'GET /user/watch-history',
        preferences: 'GET /user/preferences',
        stats: 'GET /user/stats'
      },
      chat: {
        messages: 'GET /chat/messages',
        send: 'POST /chat/messages'
      },
      admin: {
        users: 'GET /admin/users',
        videos: 'GET /admin/videos',
        reports: 'GET /admin/reports'
      },
      reports: {
        create: 'POST /reports/video/:videoId',
        myReports: 'GET /reports/my-reports'
      }
    },
    features: {
      realTime: 'WebSocket connections for live updates',
      recommendations: 'AI-powered video recommendations',
      moderation: 'Content reporting and admin moderation',
      analytics: 'User engagement and video metrics',
      security: 'Rate limiting, CORS, and authentication',
      search: 'Advanced search with filters and hashtags',
      staticFiles: 'Avatar and video file serving',
      thumbnails: 'Automatic thumbnail generation for videos' // ✅ تحديث الميزات
    }
  });
});

// Test CORS endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: 'CORS is working perfectly! 🎉',
    origin: req.headers.origin,
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins: [process.env.CLIENT_URL].filter(Boolean),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
    }
  });
});


// Test POST endpoint for CORS
app.post('/api/cors-test', (req, res) => {
  res.json({
    message: 'POST request CORS is working! 🚀',
    data: req.body,
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    headers: {
      'content-type': req.headers['content-type'],
      authorization: !!req.headers.authorization
    }
  });
});

// Static files info endpoint
app.get('/api/static-info', (req, res) => {
  res.json({
    staticFiles: {
      avatars: '${import.meta.env.VITE_API_URL}/uploads/avatars/',
      videos: '${import.meta.env.VITE_API_URL}/uploads/videos/',
      thumbnails: '${import.meta.env.VITE_API_URL}/thumbnails/',
      defaultAvatar: '${import.meta.env.VITE_API_URL}/default-avatar.png',
      defaultThumbnail: '${import.meta.env.VITE_API_URL}/default-thumbnail.jpg'
    },
    uploadsDirectory: path.join(__dirname, 'uploads'),
    thumbnailsDirectory: path.join(__dirname, 'thumbnails'),
    publicDirectory: path.join(__dirname, 'public')
  });
});

// Reports system info endpoint
app.get('/api/reports-info', (req, res) => {
  res.json({
    system: 'Advanced Video Reports Management',
    version: '2.0.0',
    endpoints: {
      createReport: 'POST /api/reports/video/:videoId',
      getMyReports: 'GET /api/reports/my-reports',
      getAllReports: 'GET /api/admin/reports',
      updateReport: 'PATCH /api/admin/reports/:id/status',
      deleteVideo: 'POST /api/admin/reports/:reportId/delete-video',
      keepVideo: 'POST /api/admin/reports/:reportId/keep-video'
    },
    features: [
      'User video reporting with categories',
      'Admin report management dashboard',
      'Real-time notifications',
      'Video deletion with detailed reasoning',
      'Report status tracking (pending, reviewed, resolved)',
      'User notification when action is taken'
    ],
    reportCategories: [
      'inappropriate_content',
      'copyright_violation',
      'spam_or_misleading',
      'harassment',
      'other'
    ]
  });
});

// Recommendations system info
app.get('/api/recommendations-info', (req, res) => {
  res.json({
    system: 'AI-Powered Video Recommendations',
    version: '1.0.0',
    algorithms: [
      'Collaborative Filtering',
      'Content-Based Filtering',
      'Hybrid Approach',
      'Trending Analysis'
    ],
    factors: [
      'User watch history',
      'Likes and interactions',
      'Following relationships',
      'Video categories and tags',
      'Engagement metrics',
      'Temporal trends'
    ],
    endpoints: {
      personalized: 'GET /api/recommendations/personalized',
      trending: 'GET /api/recommendations/trending',
      similar: 'GET /api/recommendations/similar/:videoId',
      forYou: 'GET /api/recommendations/for-you'
    }
  });
});

// Search system info endpoint
app.get('/api/search-info', (req, res) => {
  res.json({
    system: 'Advanced Search System',
    version: '1.0.0',
    endpoints: {
      search: 'GET /api/search',
      hashtags: 'GET /api/search/hashtags',
      suggestions: 'GET /api/search/suggestions',
      trendingHashtags: 'GET /api/search/trending-hashtags',
      history: 'GET /api/search/history',
      recommendations: 'GET /api/search/recommendations'
    },
    features: [
      'Search videos and users',
      'Hashtag-based filtering',
      'Auto-complete suggestions',
      'Trending hashtags',
      'Search history',
      'Personalized search recommendations'
    ],
    searchTypes: ['all', 'videos', 'users'],
    filters: ['relevance', 'trending', 'latest', 'hashtags']
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🌟 Nojoom Server API - Advanced Social Video Platform',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    documentation: `${req.protocol}://${req.get('host')}/api/docs`,
    status: 'operational',
    endpoints: {
      health: '/api/health',
      metrics: '/api/metrics',
      docs: '/api/docs',
      corsTest: '/api/cors-test',
      staticInfo: '/api/static-info',
      reportsInfo: '/api/reports-info',
      recommendationsInfo: '/api/recommendations-info',
      searchInfo: '/api/search-info',
      auth: '/api/auth',
      videos: '/api/videos',
      search: '/api/search',
      recommendations: '/api/recommendations',
      chat: '/api/chat',
      admin: '/api/admin',
      users: '/api/users',
      user: '/api/user',
      messages: '/api/messages',
      reports: '/api/reports'
    },
    features: {
      authentication: 'JWT with refresh tokens & rate limiting',
      videoSharing: 'Upload, stream, like, and comment system',
      realTimeChat: 'Socket.io based with rooms',
      recommendations: 'AI-powered personalized video suggestions',
      adminPanel: 'Advanced content moderation & analytics',
      reportingSystem: 'Comprehensive video reporting & management',
      userManagement: 'Profiles, relationships, and interactions',
      searchSystem: 'Advanced search with filters and hashtags',
      security: 'Helmet, CORS, rate limiting, and input validation',
      performance: 'Compression, caching, and optimized queries',
      staticFiles: 'Avatar and video file serving with caching',
      thumbnails: 'Automatic thumbnail generation for videos' // ✅ تحديث الميزات
    },
    statistics: {
      activeSince: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      uptime: process.uptime()
    }
  });
});

// ==================== Error Handling ====================
// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /api/health',
      'GET /api/docs',
      'GET /api/metrics',
      'GET /api/cors-test',
      'GET /api/static-info',
      'GET /api/search-info',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/videos',
      'GET /api/search',
      'GET /api/recommendations/personalized',
      'GET /api/users',
      'GET /api/user/watch-history',
      'GET /api/user/preferences',
      'GET /api/user/stats',
      'GET /api/messages',
      'POST /api/reports/video/:videoId',
      'GET /api/reports/my-reports'
    ]
  });
});

// General 404 handler for all undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'Visit /api/docs for available endpoints',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Log to file in production
  if (process.env.NODE_ENV === 'production') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    };

    fs.appendFileSync(
      path.join(__dirname, 'logs', 'errors.log'),
      JSON.stringify(logEntry) + '\n'
    );
  }

  const errorResponse = {
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  res.status(err.status || 500).json(errorResponse);
});

// ==================== Socket.io Initialization ====================

// Initialize Socket.io after routes
initSocket(server);

// ==================== Graceful Shutdown ====================

process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

// ==================== Start the Server ====================

startServer();

export default app;
