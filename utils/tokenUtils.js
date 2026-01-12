// utils/tokenUtils.js
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { jwtConfig } from '../config/jwt.js';

/**
 * إنشاء توكنات جديدة للمستخدم
 */
export const generateTokens = async (user) => {
  try {
    // إنشاء access token
    const accessToken = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        email: user.email 
      },
      jwtConfig.secret,
      { 
        expiresIn: jwtConfig.expiresIn,
        issuer: 'your-app-name',
        subject: user.id.toString()
      }
    );

    // إنشاء refresh token
    const refreshToken = jwt.sign(
      { 
        id: user.id,
        type: 'refresh'
      },
      jwtConfig.refreshSecret,
      { 
        expiresIn: jwtConfig.refreshExpiresIn,
        issuer: 'your-app-name',
        subject: user.id.toString()
      }
    );

    // حفظ refresh token في قاعدة البيانات
    await saveRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: getTokenExpiry(accessToken)
    };
  } catch (error) {
    console.error('Error generating tokens:', error);
    throw new Error('Failed to generate tokens');
  }
};

/**
 * حفظ refresh token في قاعدة البيانات
 */
export const saveRefreshToken = async (userId, refreshToken) => {
  try {
    // حساب وقت انتهاء الصلاحية (7 أيام من الآن)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // حفظ أو تحديث الـ refresh token
    await pool.execute(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) 
       VALUES (?, ?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE 
       token = VALUES(token), 
       expires_at = VALUES(expires_at), 
       updated_at = NOW()`,
      [userId, refreshToken, expiresAt]
    );

    console.log(`✅ Refresh token saved for user ${userId}`);
  } catch (error) {
    console.error('Error saving refresh token:', error);
    throw new Error('Failed to save refresh token');
  }
};

/**
 * التحقق من صحة access token
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    return { valid: true, decoded, error: null };
  } catch (error) {
    return { valid: false, decoded: null, error };
  }
};

/**
 * التحقق من صحة refresh token
 */
export const verifyRefreshToken = async (token) => {
  try {
    // التحقق من الـ JWT أولاً
    const decoded = jwt.verify(token, jwtConfig.refreshSecret);
    
    // ثم التحقق من وجوده في قاعدة البيانات
    const [tokens] = await pool.execute(
      'SELECT user_id, is_revoked FROM refresh_tokens WHERE token = ?',
      [token]
    );

    if (tokens.length === 0) {
      return { valid: false, decoded: null, error: 'Token not found in database' };
    }

    if (tokens[0].is_revoked) {
      return { valid: false, decoded: null, error: 'Token revoked' };
    }

    return { valid: true, decoded, error: null };
  } catch (error) {
    return { valid: false, decoded: null, error };
  }
};

/**
 * تجديد التوكنات باستخدام refresh token
 */
export const refreshTokens = async (refreshToken) => {
  try {
    // التحقق من صحة الـ refresh token
    const verification = await verifyRefreshToken(refreshToken);
    
    if (!verification.valid) {
      throw new Error(verification.error.message || 'Invalid refresh token');
    }

    const userId = verification.decoded.id;

    // جلب بيانات المستخدم
    const [users] = await pool.execute(
      'SELECT id, username, email, role, is_banned, ban_reason, deleted_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    // التحقق من حالة المستخدم
    if (user.is_banned) {
      throw new Error('Account suspended');
    }

    if (user.deleted_at) {
      throw new Error('Account deleted');
    }

    // إنشاء توكنات جديدة
    const newTokens = await generateTokens(user);

    // إلغاء الـ refresh token القديم
    await revokeRefreshToken(refreshToken);

    return {
      ...newTokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    throw error;
  }
};

/**
 * إلغاء refresh token
 */
export const revokeRefreshToken = async (token) => {
  try {
    await pool.execute(
      'UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE token = ?',
      [token]
    );
    console.log(`✅ Refresh token revoked`);
  } catch (error) {
    console.error('Error revoking refresh token:', error);
    throw new Error('Failed to revoke token');
  }
};

/**
 * إلغاء جميع refresh tokens للمستخدم
 */
export const revokeAllUserTokens = async (userId) => {
  try {
    await pool.execute(
      'UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE user_id = ?',
      [userId]
    );
    console.log(`✅ All refresh tokens revoked for user ${userId}`);
  } catch (error) {
    console.error('Error revoking user tokens:', error);
    throw new Error('Failed to revoke user tokens');
  }
};

/**
 * الحصول على وقت انتهاء صلاحية التوكن
 */
export const getTokenExpiry = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded.exp * 1000; // تحويل إلى ملي ثانية
  } catch (error) {
    return null;
  }
};

/**
 * التحقق مما إذا كان التوكن على وشك الانتهاء
 */
export const isTokenExpiringSoon = (token, thresholdMinutes = 5) => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;

  const now = Date.now();
  const threshold = thresholdMinutes * 60 * 1000; // تحويل إلى ملي ثانية
  
  return (expiry - now) <= threshold;
};

/**
 * تنظيف الـ refresh tokens المنتهية من قاعدة البيانات
 */
export const cleanupExpiredTokens = async () => {
  try {
    const result = await pool.execute(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = TRUE'
    );
    
    console.log(`✅ Cleaned up ${result[0].affectedRows} expired tokens`);
    return result[0].affectedRows;
  } catch (error) {
    console.error('Error cleaning up tokens:', error);
    return 0;
  }
};

/**
 * إنشاء توكن مؤقت للعمليات الحساسة (كتحقق البريد الإلكتروني، إلخ)
 */
export const generateTempToken = (payload, expiresIn = '1h') => {
  return jwt.sign(
    { ...payload, type: 'temp' },
    jwtConfig.secret,
    { expiresIn }
  );
};

/**
 * التحقق من التوكن المؤقت
 */
export const verifyTempToken = (token) => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    
    if (decoded.type !== 'temp') {
      return { valid: false, decoded: null, error: 'Invalid token type' };
    }
    
    return { valid: true, decoded, error: null };
  } catch (error) {
    return { valid: false, decoded: null, error };
  }
};

// تشغيل تنظيف التوكنات المنتهية تلقائياً
setInterval(() => {
  cleanupExpiredTokens().catch(console.error);
}, 24 * 60 * 60 * 1000); // كل 24 ساعة

export default {
  generateTokens,
  saveRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshTokens,
  revokeRefreshToken,
  revokeAllUserTokens,
  getTokenExpiry,
  isTokenExpiringSoon,
  cleanupExpiredTokens,
  generateTempToken,
  verifyTempToken
};