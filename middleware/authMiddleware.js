import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { refreshTokens, verifyAccessToken } from '../utils/tokenUtils.js';

// تخزين مؤقت لمحاولات تسجيل الدخول
const loginAttempts = new Map();
const BLOCK_DURATION = 15 * 60 * 1000; // 15 دقيقة
const MAX_LOGIN_ATTEMPTS = 5;

// Middleware محسن للتحقق من التوكن مع تجديد تلقائي
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // الحصول على refresh token من الـ headers أو body
  const refreshToken = req.headers['refresh-token'] || req.headers['x-refresh-token'] || req.body?.refreshToken;

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_REQUIRED'
    });
  }

  try {
    // محاولة التحقق من التوكن الأساسي
    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.is_banned) {
      return res.status(403).json({ 
        error: 'Account suspended', 
        reason: user.ban_reason,
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    if (user.deleted_at) {
      return res.status(403).json({ 
        error: 'Account has been deleted',
        code: 'ACCOUNT_DELETED'
      });
    }

    req.user = user;
    next();

  } catch (error) {
    console.error('Token verification error:', error);

    if (error.name === 'TokenExpiredError') {
      // إذا انتهت صلاحية التوكن، نتحقق من وجود refresh token
      if (!refreshToken) {
        return res.status(401).json({ 
          error: 'Token expired, refresh token required',
          code: 'TOKEN_EXPIRED'
        });
      }

      try {
        // استخدام الـ refresh token للحصول على توكن جديد
        const newTokens = await refreshAccessToken(refreshToken);
        res.set('New-Access-Token', newTokens.accessToken);
        res.set('New-Refresh-Token', newTokens.refreshToken);

        // فك توكن جديد بدون تحقق كامل للحصول على المستخدم
        const decodedNew = jwt.decode(newTokens.accessToken);
        const user = await User.findById(decodedNew.id);

        if (!user || user.is_banned || user.deleted_at) {
          return res.status(403).json({ 
            error: 'User inactive',
            code: 'USER_INACTIVE'
          });
        }

        req.user = user;
        return next();

      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return res.status(401).json({ 
          error: 'Refresh token invalid or expired',
          code: 'TOKEN_REFRESH_FAILED'
        });
      }
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(403).json({ 
      error: 'Token verification failed',
      code: 'TOKEN_VERIFICATION_FAILED'
    });
  }
};

// دالة مساعدة لتجديد التوكن
async function refreshAccessToken(refreshToken) {
  try {
    // التحقق من الـ refresh token في قاعدة البيانات
    const [tokens] = await pool.execute(
      'SELECT user_id, is_revoked FROM refresh_tokens WHERE token = ?',
      [refreshToken]
    );

    if (tokens.length === 0 || tokens[0].is_revoked) {
      throw new Error('Invalid or revoked refresh token');
    }

    // التحقق من صحة الـ JWT
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
    
    if (decoded.id !== tokens[0].user_id) {
      throw new Error('Token user ID mismatch');
    }

    // جلب بيانات المستخدم
    const [users] = await pool.execute(
      'SELECT id, username, email, role, is_banned, ban_reason, deleted_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0 || users[0].is_banned || users[0].deleted_at) {
      throw new Error('User not found or inactive');
    }

    const user = users[0];

    // إنشاء توكنات جديدة
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    const newRefreshToken = jwt.sign(
      { id: user.id },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn }
    );

    // تحديث الـ refresh token في قاعدة البيانات
    await pool.execute(
      'UPDATE refresh_tokens SET token = ?, expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE token = ?',
      [newRefreshToken, refreshToken]
    );

    return {
      accessToken,
      refreshToken: newRefreshToken
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

// middleware مبسط للتحقق من التوكن بدون تجديد تلقائي
export const strictAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_REQUIRED'
    });
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.is_banned || user.deleted_at) {
      return res.status(403).json({ 
        error: 'Account not active',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired - please refresh',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(403).json({ 
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// باقي الـ middlewares تبقى كما هي مع بعض التحسينات
export const authenticateRefreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    console.log('❌ No refresh token provided');
    return res.status(401).json({ 
      error: 'Refresh token required',
      code: 'REFRESH_TOKEN_REQUIRED'
    });
  }

  try {
    // التحقق من الـ refresh token في قاعدة البيانات أولاً
    const [tokens] = await pool.execute(
      'SELECT user_id, is_revoked FROM refresh_tokens WHERE token = ?',
      [refreshToken]
    );

    if (tokens.length === 0) {
      console.log('❌ Refresh token not found in database');
      return res.status(403).json({ 
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (tokens[0].is_revoked) {
      console.log('❌ Refresh token has been revoked');
      return res.status(403).json({ 
        error: 'Refresh token revoked',
        code: 'REFRESH_TOKEN_REVOKED'
      });
    }

    // ثم التحقق من الـ JWT
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
    
    if (decoded.id !== tokens[0].user_id) {
      console.log('❌ Token user ID mismatch');
      return res.status(403).json({ 
        error: 'Invalid refresh token',
        code: 'TOKEN_USER_MISMATCH'
      });
    }

    console.log('✅ Refresh token verified for user ID:', decoded.id);
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    console.log('❌ Refresh token verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      // حذف الـ refresh token المنتهي
      await pool.execute(
        'DELETE FROM refresh_tokens WHERE token = ?',
        [refreshToken]
      );
      return res.status(403).json({ 
        error: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }
    
    return res.status(403).json({ 
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
};

export const refreshTokenMiddleware = async (req, res, next) => {
  try {
    const refreshToken = req.headers['refresh-token'] || req.body.refreshToken;

    if (!refreshToken) {
      console.log('❌ No refresh token provided');
      return res.status(401).json({ 
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    // استخدام دالة تجديد التوكن المساعدة
    const newTokens = await refreshAccessToken(refreshToken);
    
    if (!newTokens) {
      return res.status(403).json({ 
        error: 'Failed to refresh tokens',
        code: 'TOKEN_REFRESH_FAILED'
      });
    }

    // إضافة التوكنات الجديدة إلى الـ request
    req.newTokens = newTokens;
    
    // جلب بيانات المستخدم الكاملة
    const decoded = jwt.decode(newTokens.accessToken);
    const [users] = await pool.execute(
      'SELECT id, username, email, role, is_banned, ban_reason, deleted_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = users[0];
    console.log('✅ Tokens refreshed for user:', req.user.username);
    next();

  } catch (error) {
    console.error('❌ Refresh token middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        error: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// باقي الـ middlewares تبقى كما هي...
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }
  
  next();
};

export const requireModerator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ 
      error: 'Moderator access required',
      code: 'MODERATOR_ACCESS_REQUIRED'
    });
  }
  
  next();
};

export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }
  
  next();
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      const user = await User.findById(decoded.id);
      
      if (user && !user.is_banned && !user.deleted_at) {
        req.user = user;
      }
    } catch (error) {
      // تجاهل الأخطاء في المصادقة الاختيارية
      console.log('Optional auth failed (non-critical):', error.message);
    }
  }
  
  next();
};

// تصدير باسم optional لتتوافق مع الاستيراد في searchRoutes.js
export const optional = optionalAuth;

// تصدير باسم required لتتوافق مع الاستيراد في searchRoutes.js  
export const required = requireAuth;

export const requireSameUserOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  const requestedUserId = parseInt(req.params.userId || req.params.id);
  
  if (req.user.role !== 'admin' && req.user.id !== requestedUserId) {
    return res.status(403).json({ 
      error: 'Access denied. You can only access your own data.',
      code: 'ACCESS_DENIED'
    });
  }
  
  next();
};

export const requireVideoOwnerOrAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
    });
  }

    const videoId = req.params.videoId || req.params.id;
    
    if (!videoId) {
      return res.status(400).json({ 
        error: 'Video ID is required',
        code: 'VIDEO_ID_REQUIRED'
      });
    }

    const [videos] = await pool.execute(
      'SELECT user_id FROM videos WHERE id = ? AND deleted_by_admin = FALSE',
      [videoId]
    );

    if (videos.length === 0) {
      return res.status(404).json({ 
        error: 'Video not found',
        code: 'VIDEO_NOT_FOUND'
      });
    }

    const videoOwnerId = videos[0].user_id;
    
    if (req.user.role !== 'admin' && req.user.id !== videoOwnerId) {
      return res.status(403).json({ 
        error: 'Access denied. You can only manage your own videos.',
        code: 'ACCESS_DENIED'
      });
    }
    
    next();
  } catch (error) {
    console.error('Video owner check error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const requireChatAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const videoId = req.params.videoId || req.body.videoId;
    
    if (!videoId) {
      return res.status(400).json({ 
        error: 'Video ID is required',
        code: 'VIDEO_ID_REQUIRED'
      });
    }

    const [videos] = await pool.execute(
      `SELECT v.id, v.user_id, v.is_private, v.deleted_by_admin,
              uv.user_id as can_access
       FROM videos v
       LEFT JOIN user_video_access uv ON v.id = uv.video_id AND uv.user_id = ?
       WHERE v.id = ?`,
      [req.user.id, videoId]
    );

    if (videos.length === 0) {
      return res.status(404).json({ 
        error: 'Video not found',
        code: 'VIDEO_NOT_FOUND'
      });
    }

    const video = videos[0];

    if (video.deleted_by_admin) {
      return res.status(403).json({ 
        error: 'This video has been removed by admin',
        code: 'VIDEO_REMOVED'
      });
    }

    if (video.is_private && !video.can_access && req.user.id !== video.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied to this video chat',
        code: 'CHAT_ACCESS_DENIED'
      });
    }

    req.video = video;
    next();
  } catch (error) {
    console.error('Chat access check error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const requireBroadcastAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ 
        error: 'Broadcast access requires admin or moderator role',
        code: 'BROADCAST_ACCESS_DENIED'
      });
    }

    const [permissions] = await pool.execute(
      'SELECT can_broadcast FROM admin_permissions WHERE user_id = ?',
      [req.user.id]
    );

    if (permissions.length === 0 || !permissions[0].can_broadcast) {
      return res.status(403).json({ 
        error: 'You do not have permission to send broadcasts',
        code: 'BROADCAST_PERMISSION_DENIED'
      });
    }

    next();
  } catch (error) {
    console.error('Broadcast access check error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const preventBruteForce = (req, res, next) => {
  const identifier = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!loginAttempts.has(identifier)) {
    loginAttempts.set(identifier, { count: 1, firstAttempt: now });
    return next();
  }

  const attempts = loginAttempts.get(identifier);
  const timeSinceFirstAttempt = now - attempts.firstAttempt;

  if (timeSinceFirstAttempt > BLOCK_DURATION) {
    loginAttempts.set(identifier, { count: 1, firstAttempt: now });
    return next();
  }

  attempts.count++;

  if (attempts.count > MAX_LOGIN_ATTEMPTS) {
    const remainingTime = Math.ceil((BLOCK_DURATION - timeSinceFirstAttempt) / 1000 / 60);
    return res.status(429).json({
      error: 'Too many login attempts',
      message: `Please try again in ${remainingTime} minutes`,
      code: 'TOO_MANY_ATTEMPTS',
      retryAfter: remainingTime
    });
  }

  next();
};

export const checkSystemStatus = async (req, res, next) => {
  try {
    const [systemStatus] = await pool.execute(
      'SELECT maintenance_mode, chat_enabled, upload_enabled FROM system_settings WHERE id = 1'
    );

    if (systemStatus.length === 0) {
      return next();
    }

    const status = systemStatus[0];

    if (status.maintenance_mode && req.user?.role !== 'admin') {
      return res.status(503).json({
        error: 'System is under maintenance',
        code: 'MAINTENANCE_MODE'
      });
    }

    if (req.path.includes('/chat') && !status.chat_enabled && req.user?.role !== 'admin') {
      return res.status(503).json({
        error: 'Chat system is temporarily disabled',
        code: 'CHAT_DISABLED'
      });
    }

    if (req.path.includes('/upload') && !status.upload_enabled && req.user?.role !== 'admin') {
      return res.status(503).json({
        error: 'Upload system is temporarily disabled',
        code: 'UPLOAD_DISABLED'
      });
    }

    next();
  } catch (error) {
    console.error('System status check error:', error);
    next();
  }
};

export const rateLimitMiddleware = (windowMs, maxRequests, keyGenerator = null) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : (req.ip || req.connection.remoteAddress);
    const now = Date.now();
    const windowStart = now - windowMs;

    if (requests.has(key)) {
      requests.set(key, requests.get(key).filter(time => time > windowStart));
    }

    const currentRequests = requests.get(key) || [];
    
    if (currentRequests.length >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    currentRequests.push(now);
    requests.set(key, currentRequests);
    
    next();
  };
};

export const chatRateLimit = rateLimitMiddleware(60000, 30, (req) => {
  return `chat_${req.user?.id || req.ip}`;
});

export const uploadRateLimit = rateLimitMiddleware(300000, 5, (req) => {
  return `upload_${req.user?.id || req.ip}`;
});

export const validateUserStatus = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.is_banned) {
      return res.status(403).json({ 
        error: 'Account suspended', 
        reason: user.ban_reason,
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    if (user.deleted_at) {
      return res.status(403).json({ 
        error: 'Account has been deleted',
        code: 'ACCOUNT_DELETED'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('User status validation error:', error);
    next();
  }
};

export const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required',
      code: 'API_KEY_REQUIRED'
    });
  }

  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(403).json({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  next();
};

export const requireCsrfToken = (req, res, next) => {
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!csrfToken) {
    return res.status(403).json({ 
      error: 'CSRF token required',
      code: 'CSRF_TOKEN_REQUIRED'
    });
  }

  if (req.session && req.session.csrfToken !== csrfToken) {
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      code: 'INVALID_CSRF_TOKEN'
    });
  }

  next();
};

// تنظيف محاولات تسجيل الدخول القديمة
setInterval(() => {
  const now = Date.now();
  for (const [identifier, attempts] of loginAttempts.entries()) {
    if (now - attempts.firstAttempt > BLOCK_DURATION) {
      loginAttempts.delete(identifier);
    }
  }
}, 60000);

// تصدير جميع الميدلوير
export default {
  authenticateToken,
  strictAuth,
  authenticateRefreshToken,
  refreshTokenMiddleware,
  requireAdmin,
  requireModerator,
  requireAuth,
  optionalAuth,
  optional,
  required,
  requireSameUserOrAdmin,
  requireVideoOwnerOrAdmin,
  requireChatAccess,
  requireBroadcastAccess,
  preventBruteForce,
  checkSystemStatus,
  rateLimitMiddleware,
  chatRateLimit,
  uploadRateLimit,
  validateUserStatus,
  requireApiKey,
  requireCsrfToken
};