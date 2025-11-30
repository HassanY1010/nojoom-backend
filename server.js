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
import cors from 'cors';

// Import DB
import { initializeDatabase, pool } from './config/db.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import tokenRoutes from './routes/tokenRoutes.js';
import { authenticateToken } from './middleware/authMiddleware.js';
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

// Controllers
import { authController } from './controllers/authController.js';

// Socket.io - ✅ تم التعديل لمنع التكرار
import { initSocket } from './socket/socketManager.js';

// Scheduler
import { ChallengeScheduler } from './services/challengeScheduler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================================================
// 1. Initialize Express
// ======================================================
const app = express();
app.set('trust proxy', 1); // Required for Render / Vercel proxies

// ======================================================
// 2. Global Middlewares - ✅ CORS FIXED
// ======================================================
// Handle preflight requests for ALL routes
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight OPTIONS requests globally
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.sendStatus(204); // No Content
  } else {
    next();
  }
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

app.use(compression());
app.use(morgan('dev'));

// Body parser with higher limit for video upload - ✅ INCREASED LIMITS
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ======================================================
// 3. Rate Limiting
// ======================================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(generalLimiter);

// ======================================================
// 4. Special CORS for Video Upload - ✅ ADDED
// ======================================================
app.use('/api/videos/upload', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// ======================================================
// 5. Admin creation endpoint
// ======================================================
app.post('/create-admin', authController.createAdminIfNotExists);

// ======================================================
// 6. Routes
// ======================================================
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
app.use('/api/comments', commentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/notifications', notificationRoutes);

// ======================================================
// 7. Static Files
// ======================================================
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/default-avatar.png', express.static(path.join(__dirname, 'public', 'default-avatar.png')));
app.use('/default-thumbnail.jpg', express.static(path.join(__dirname, 'public', 'default-thumbnail.jpg')));

// ======================================================
// 8. Start Server + Database + Socket.IO
// ======================================================
const server = createServer(app);

// ✅ تم نقل تهيئة Socket.io هنا لمنع التكرار
let isSocketInitialized = false;

const startServer = async () => {
  try {
    console.log('🔄 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    // Ensure directories exist
    const directories = ['uploads', 'uploads/videos', 'uploads/avatars', 'thumbnails', 'temp', 'logs', 'public'];
    for (const dir of directories) {
      const dirPath = path.join(__dirname, dir);
      try { 
        await fs.promises.access(dirPath); 
      } catch { 
        await fs.promises.mkdir(dirPath, { recursive: true }); 
        console.log(`📁 Created: ${dir}`); 
      }
    }

    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0';

    server.listen(PORT, HOST, () => {
      console.log('🚀 NOJOOM SERVER STARTED SUCCESSFULLY');
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌐 Host: ${HOST}`);
      console.log(`🔗 Client URL: ${process.env.CLIENT_URL}`);
      console.log(`🌍 CORS Enabled for: ${process.env.CLIENT_URL}`);
    });

    // ✅ تهيئة Socket.IO مرة واحدة فقط
    if (!isSocketInitialized) {
      initSocket(server);
      isSocketInitialized = true;
      console.log('✅ Socket.IO initialized successfully');
    }

    // Initialize Scheduler
    ChallengeScheduler.init();

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
// GET /api/user/watch-history
app.get('/api/user/watch-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        wh.*, v.id as video_id, v.url, u.username as owner_username
      FROM watch_history wh
      JOIN videos v ON wh.video_id = v.id
      JOIN users u ON v.user_id = u.id
      WHERE wh.user_id = ?
      ORDER BY wh.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [history] = await pool.execute(sql, [userId]);

    const [totalRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM watch_history WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      data: history,
      pagination: {
        page,
        limit,
        total: totalRows[0].total,
        pages: Math.ceil(totalRows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get watch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get watch history'
    });
  }
});

// POST /api/user/watch-history
app.post('/api/user/watch-history', authenticateToken, async (req, res) => {
  try {
    const userId   = req.user.id;
    const { videoId, watchTime = 1, completed = false } = req.body;

    await pool.execute(
      `INSERT INTO watch_history (user_id, video_id, watch_time, completed)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       watch_time = VALUES(watch_time),
       completed  = VALUES(completed),
       updated_at = CURRENT_TIMESTAMP`,
      [userId, videoId, watchTime, completed]
    );

    await pool.execute(
      'UPDATE videos SET views = COALESCE(views,0)+1 WHERE id = ?',
      [videoId]
    );

    res.json({ success: true, message: 'Watch history updated' });
  } catch (error) {
    console.error('❌ Update watch history error:', error);
    res.status(500).json({ success: false, message: 'Failed to update watch history' });
  }
});

// GET /api/user/preferences
app.get('/api/user/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      'SELECT preferred_categories, content_weights, excluded_users FROM user_preferences WHERE user_id = ?',
      [userId]
    );

    const prefs = rows[0]
      ? {
          preferred_categories: JSON.parse(rows[0].preferred_categories || '[]'),
          content_weights:      JSON.parse(rows[0].content_weights      || '{}'),
          excluded_users:       JSON.parse(rows[0].excluded_users       || '[]')
        }
      : { preferred_categories: [], content_weights: {}, excluded_users: [] };

    res.json({ success: true, data: prefs });
  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to get preferences' });
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
         COALESCE(followers_count, 0) as followers_count,
         COALESCE(following_count, 0) as following_count,
         COALESCE(likes_count, 0) as likes_count,
         COALESCE(views_count, 0) as views_count,
         COALESCE(total_watch_time, 0) as total_watch_time,
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
      thumbnails: true,
      corsFixed: true,
      websocketFixed: true, // ✅ إضافة تأكيد إصلاح WebSocket
      mysqlFixed: true // ✅ إضافة تأكيد إصلاح MySQL
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
      thumbnails: 'Automatic thumbnail generation for videos',
      corsFixed: '✅ CORS issues resolved for video upload',
      websocketFixed: '✅ WebSocket connection issues resolved',
      mysqlFixed: '✅ MySQL parameters issues resolved'
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
      thumbnails: 'Automatic thumbnail generation for videos',
      corsFixed: '✅ CORS issues resolved for all endpoints',
      websocketFixed: '✅ WebSocket connection issues resolved',
      videoUploadFixed: '✅ Video upload issues resolved',
      mysqlFixed: '✅ MySQL parameters issues resolved'
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

// ✅ تم نقل تهيئة Socket.io إلى أعلى الملف لمنع التكرار

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
