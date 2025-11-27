import { User } from '../models/User.js';
import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';

export const usersController = {
  // ==================== تسجيل الدخول ====================

  // ✅ تسجيل الدخول مع إرسال role في الاستجابة
  async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log('🔄 Login attempt for email:', email);

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // البحث عن المستخدم بالبريد الإلكتروني
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        console.log('❌ User not found for email:', email);
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      const user = users[0];

      console.log('🔍 User found:', {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        is_banned: user.is_banned
      });

      // التحقق من حالة الحظر
      if (user.is_banned) {
        console.log('❌ User is banned:', user.email);
        return res.status(403).json({
          error: 'Account suspended',
          reason: user.ban_reason
        });
      }

      // ✅ التحقق من كلمة المرور
      console.log('🔐 Checking password...');

      let isValidPassword = false;

      // ✅ للمدير: تحقق من كلمة المرور الواضحة أولاً (للتطوير)
      if (user.role === 'admin' && password === user.password) {
        isValidPassword = true;
        console.log('✅ Admin plain password matched');
      } else {
        // للمستخدمين العاديين: استخدم bcrypt
        isValidPassword = await bcrypt.compare(password, user.password);
        console.log('✅ Password validation result:', isValidPassword);
      }

      if (!isValidPassword) {
        console.log('❌ Invalid password for user:', user.email);
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      // إنشاء tokens
      const accessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },
        jwtConfig.secret,
        { expiresIn: jwtConfig.accessExpiration || '1h' } // قيمة افتراضية
      );

      const refreshToken = jwt.sign(
        {
          id: user.id,
          role: user.role
        },
        jwtConfig.refreshSecret,
        { expiresIn: jwtConfig.refreshExpiration || '7d' } // قيمة افتراضية
      );

      // حفظ refresh token في قاعدة البيانات
      await pool.execute(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
        [user.id, refreshToken]
      );

      // تحديث آخر تسجيل دخول
      await pool.execute(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );

      console.log('✅ Login successful for user:', {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      });

      // إرسال الاستجابة مع تضمين role
      res.json({
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          bio: user.bio,
          social_links: user.social_links,
          followers_count: user.followers_count,
          following_count: user.following_count,
          likes_count: user.likes_count,
          views_count: user.views_count,
          total_watch_time: user.total_watch_time,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          is_banned: user.is_banned,
          created_at: user.created_at,
          last_login: user.last_login
        }
      });

    } catch (error) {
      console.error('❌ Login error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ==================== إنشاء حساب مدير (للتطوير) ====================

  // ✅ دالة لإنشاء حساب مدير بدون تشفير
  async createAdminIfNotExists(req, res) {
    try {
      const adminEmail = 'admin@nojoom.com';
      const adminPassword = 'admin123'; // كلمة مرور واضحة
      const adminUsername = 'admin';

      // التحقق إذا كان المدير موجوداً بالفعل
      const [existingAdmins] = await pool.execute(
        'SELECT * FROM users WHERE email = ? OR username = ?',
        [adminEmail, adminUsername]
      );

      if (existingAdmins.length > 0) {
        console.log('✅ Admin account already exists:', existingAdmins[0].email);
        return res.json({
          message: 'Admin account already exists',
          admin: {
            id: existingAdmins[0].id,
            email: existingAdmins[0].email,
            username: existingAdmins[0].username,
            role: existingAdmins[0].role,
            password: 'admin123'
          }
        });
      }

      // ⚠️ إنشاء حساب مدير بدون تشفير (للتطوير فقط)
      const [result] = await pool.execute(
        `INSERT INTO users (username, email, password, role, email_verified, is_banned) 
         VALUES (?, ?, ?, 'admin', TRUE, FALSE)`,
        [adminUsername, adminEmail, adminPassword]
      );

      console.log('✅ Admin account created (PLAIN PASSWORD):', {
        id: result.insertId,
        email: adminEmail,
        username: adminUsername
      });

      res.json({
        message: 'Admin account created successfully',
        admin: {
          id: result.insertId,
          email: adminEmail,
          username: adminUsername,
          password: adminPassword,
          note: '⚠️ Password is NOT hashed - for development only!'
        }
      });

    } catch (error) {
      console.error('❌ Error creating admin account:', error);
      res.status(500).json({
        error: 'Failed to create admin account',
        details: error.message
      });
    }
  },

  // ==================== الملف الشخصي ====================

  // ✅ الحصول على بيانات مستخدم مع فيديوهاته
  async getProfile(req, res) {
    try {
      const { username } = req.params;
      const currentUserId = req.user?.id;

      console.log('🔄 Fetching profile for:', { username, currentUserId });

      // الحصول على بيانات المستخدم
      const [users] = await pool.execute(
        `SELECT id, username, email, avatar, bio, social_links, followers_count, following_count, likes_count, views_count, total_watch_time, created_at, role 
         FROM users 
         WHERE username = ?`,
        [username]
      );

      if (users.length === 0) {
        console.log('❌ User not found:', username);
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[0];
      console.log('✅ User found:', user.id, user.username, 'Role:', user.role);

      // التحقق إذا كان المستخدم الحالي يتابع هذا المستخدم
      let isFollowing = false;
      if (currentUserId) {
        try {
          isFollowing = await User.isFollowing(currentUserId, user.id);
          console.log('📊 Following status:', isFollowing);
        } catch (followError) {
          console.error('Error checking follow status:', followError);
          isFollowing = false;
        }
      }

      // الحصول على فيديوهات المستخدم
      let videos = [];
      try {
        const [videoRows] = await pool.execute(
          `SELECT v.*, 
                  (SELECT COUNT(*) FROM likes WHERE video_id = v.id) as likes,
                  EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
           FROM videos v
           WHERE v.user_id = ?
           ORDER BY v.created_at DESC`,
          [currentUserId || 0, user.id]
        );
        videos = videoRows || [];
        console.log('🎥 Videos found:', videos.length);
      } catch (videoError) {
        console.error('Error fetching videos:', videoError);
        videos = [];
      }

      res.json({
        user,
        videos,
        isFollowing
      });

    } catch (error) {
      console.error('❌ Get profile error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message,
        code: error.code
      });
    }
  },

  // ✅ تحديث الملف الشخصي
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { username, bio } = req.body;
      const avatarFile = req.file;

      console.log('🔄 Updating profile for user:', userId, {
        username,
        bio,
        hasAvatar: !!avatarFile
      });

      let avatarPath = null;

      if (avatarFile) {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
        await fs.mkdir(uploadsDir, { recursive: true });

        avatarPath = `/uploads/avatars/${avatarFile.filename}`;
        const finalPath = path.join(uploadsDir, avatarFile.filename);

        await fs.rename(avatarFile.path, finalPath);

        console.log('✅ Avatar uploaded successfully:', avatarPath);
      }

      const updateData = {
        username: username || null,
        bio: bio || null,
        ...(avatarPath && { avatar: avatarPath })
      };

      const success = await User.updateProfile(userId, updateData);

      if (!success) return res.status(404).json({ error: 'User not found' });

      await User.updateUserStats(userId).catch(err => console.error('Stats update error:', err));

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found after update' });

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          social_links: user.social_links,
          role: user.role
        }
      });

    } catch (error) {
      console.error('❌ Update profile error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ تحديث الروابط الاجتماعية
  async updateSocialLinks(req, res) {
    try {
      const userId = req.user.id;
      const { social_links } = req.body;

      console.log('🔄 Updating social links for user:', userId);

      const success = await User.updateSocialLinks(userId, social_links);
      if (!success) return res.status(404).json({ error: 'User not found' });

      const user = await User.findById(userId);

      res.json({
        message: 'Social links updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          social_links: user.social_links,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Update social links error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ==================== الفيديوهات ====================

  // ✅ الحصول على الفيديوهات التي أعجب بها المستخدم
  async getLikedVideos(req, res) {
    try {
      const currentUserId = req.user.id;
      console.log('🔄 Fetching liked videos for user:', currentUserId);

      const videos = await User.getLikedVideos(currentUserId);

      console.log('❤️ Liked videos found:', videos.length);
      res.json({ videos });

    } catch (error) {
      console.error('Get liked videos error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ الحصول على فيديوهات المستخدم
  async getUserVideos(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const [videos] = await pool.execute(
        `SELECT v.*, 
                COUNT(DISTINCT l.user_id) as likes,
                EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
         FROM videos v
         LEFT JOIN likes l ON v.id = l.video_id
         WHERE v.user_id = ? AND v.deleted_by_admin = FALSE
         GROUP BY v.id
         ORDER BY v.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, userId, parseInt(limit), offset]
      );

      const [totalCount] = await pool.execute(
        'SELECT COUNT(*) as total FROM videos WHERE user_id = ? AND deleted_by_admin = FALSE',
        [userId]
      );

      res.json({
        success: true,
        data: videos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount[0].total,
          pages: Math.ceil(totalCount[0].total / limit)
        }
      });
    } catch (error) {
      console.error('Get user videos error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ==================== سجل المشاهدة ====================

  // ✅ الحصول على سجل المشاهدة
  async getWatchHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const [history] = await pool.execute(
        `SELECT 
          wh.*,
          v.id as video_id,
          v.title,
          v.description,
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
    } catch (error) {
      console.error('❌ Get watch history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get watch history'
      });
    }
  },

  // ✅ حذف عنصر من سجل المشاهدة
  async deleteWatchHistoryItem(req, res) {
    try {
      const userId = req.user.id;
      const { videoId } = req.params;

      await pool.execute(
        'DELETE FROM watch_history WHERE user_id = ? AND video_id = ?',
        [userId, videoId]
      );

      res.json({
        success: true,
        message: 'Video removed from watch history'
      });
    } catch (error) {
      console.error('❌ Delete watch history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete watch history item'
      });
    }
  },

  // ✅ مسح سجل المشاهدة بالكامل
  async clearWatchHistory(req, res) {
    try {
      const userId = req.user.id;

      await pool.execute(
        'DELETE FROM watch_history WHERE user_id = ?',
        [userId]
      );

      res.json({
        success: true,
        message: 'Watch history cleared successfully'
      });
    } catch (error) {
      console.error('❌ Clear watch history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear watch history'
      });
    }
  },

  // ==================== تفاعلات المستخدم ====================

  async userInteraction(req, res) {
    try {
      const userId = req.user.id;
      const { videoId, action } = req.body;

      if (!videoId || !action) {
        return res.status(400).json({ error: 'Video ID and action are required' });
      }

      const [videos] = await pool.execute(
        'SELECT id FROM videos WHERE id = ? AND deleted_by_admin = FALSE',
        [videoId]
      );

      if (videos.length === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (action === 'like') {
        await pool.execute(
          `INSERT INTO likes (user_id, video_id, created_at)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE created_at = NOW()`,
          [userId, videoId]
        );
      } else if (action === 'dislike') {
        await pool.execute(
          'DELETE FROM likes WHERE user_id = ? AND video_id = ?',
          [userId, videoId]
        );
      } else if (action === 'watch') {
        await pool.execute(
          `INSERT INTO watch_history (user_id, video_id, updated_at)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE updated_at = NOW()`,
          [userId, videoId]
        );
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

      res.json({ success: true, message: 'Interaction recorded successfully' });

    } catch (error) {
      console.error('User interaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ==================== المتابعة والمتابَعين ====================

  // ✅ البحث عن مستخدمين
  async searchUsers(req, res) {
    try {
      const { q } = req.query;
      const currentUserId = req.user.id;

      if (!q || q.trim().length < 2) {
        return res.json({ users: [] });
      }

      const users = await User.searchUsers(q.trim(), currentUserId);

      res.json({ users });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ متابعة مستخدم
  async followUser(req, res) {
    try {
      const { userId } = req.params;
      const followerId = req.user.id;

      console.log('🔄 Follow request:', { followerId, targetUserId: userId });

      if (parseInt(userId) === followerId) {
        return res.status(400).json({ error: 'Cannot follow yourself' });
      }

      const success = await User.followUser(followerId, parseInt(userId));

      if (!success) {
        return res.status(400).json({ error: 'Already following this user' });
      }

      // تسجيل التفاعل في نظام التوصية
      try {
        const { recommendationEngine } = await import('../services/recommendationEngine.js');
        await recommendationEngine.recordInteraction({
          userId: followerId,
          targetUserId: parseInt(userId),
          type: 'follow',
          weight: 1.5,
          timestamp: new Date()
        });
      } catch (recError) {
        console.error('Failed to record follow interaction:', recError);
      }

      res.json({ message: 'User followed successfully' });
    } catch (error) {
      console.error('Follow user error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ إلغاء متابعة مستخدم
  async unfollowUser(req, res) {
    try {
      const { userId } = req.params;
      const followerId = req.user.id;

      console.log('🔄 Unfollow request:', { followerId, targetUserId: userId });

      const success = await User.unfollowUser(followerId, parseInt(userId));

      if (!success) {
        return res.status(404).json({ error: 'Not following this user' });
      }

      // تسجيل التفاعل في نظام التوصية
      try {
        const { recommendationEngine } = await import('../services/recommendationEngine.js');
        await recommendationEngine.recordInteraction({
          userId: followerId,
          targetUserId: parseInt(userId),
          type: 'unfollow',
          weight: -1.0,
          timestamp: new Date()
        });
      } catch (recError) {
        console.error('Failed to record unfollow interaction:', recError);
      }

      res.json({ message: 'User unfollowed successfully' });
    } catch (error) {
      console.error('Unfollow user error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ الحصول على المتابعين لمستخدم معين
  async getFollowers(req, res) {
    try {
      const { userId } = req.params;

      console.log('🔄 Fetching followers for user:', userId);

      const [followers] = await pool.execute(
        `SELECT u.id, u.username, u.avatar, u.bio, u.created_at
         FROM followers f
         JOIN users u ON f.follower_id = u.id
         WHERE f.following_id = ? AND u.is_banned = FALSE
         ORDER BY f.created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        followers: followers || []
      });
    } catch (error) {
      console.error('❌ Get followers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch followers'
      });
    }
  },

  // ✅ الحصول على المتابَعين لمستخدم معين
  async getFollowing(req, res) {
    try {
      const { userId } = req.params;

      console.log('🔄 Fetching following for user:', userId);

      const [following] = await pool.execute(
        `SELECT u.id, u.username, u.avatar, u.bio, u.created_at
         FROM followers f
         JOIN users u ON f.following_id = u.id
         WHERE f.follower_id = ? AND u.is_banned = FALSE
         ORDER BY f.created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        following: following || []
      });
    } catch (error) {
      console.error('❌ Get following error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch following'
      });
    }
  },

  // ✅ الحصول على الإعجابات لمستخدم معين
  async getLikes(req, res) {
    try {
      const { userId } = req.params;

      console.log('🔄 Fetching likes for user:', userId);

      const [likes] = await pool.execute(
        `SELECT DISTINCT u.id, u.username, u.avatar, l.created_at
         FROM likes l
         JOIN videos v ON l.video_id = v.id
         JOIN users u ON l.user_id = u.id
         WHERE v.user_id = ? AND u.is_banned = FALSE
         ORDER BY l.created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        likes: likes || []
      });
    } catch (error) {
      console.error('❌ Get likes error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch likes'
      });
    }
  },

  // ✅ الحصول على المتابعين للمستخدم الحالي
  async getMyFollowers(req, res) {
    try {
      const userId = req.user.id;
      const followers = await User.getUserFollowers(userId);
      res.json({ followers });
    } catch (error) {
      console.error('Get followers error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ الحصول على المتابَعين للمستخدم الحالي
  async getMyFollowing(req, res) {
    try {
      const userId = req.user.id;
      const following = await User.getUserFollowing(userId);
      res.json({ following });
    } catch (error) {
      console.error('Get following error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ التحقق من حالة المتابعة
  async getFollowStatus(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      const isFollowing = await User.isFollowing(userId, parseInt(targetUserId));

      res.json({
        success: true,
        isFollowing
      });
    } catch (error) {
      console.error('Get follow status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get follow status'
      });
    }
  },

  // ==================== التفضيلات والإعدادات ====================

  // ✅ الحصول على تفضيلات المستخدم
  async getUserPreferences(req, res) {
    try {
      const userId = req.user.id;
      console.log('🔄 Getting user preferences for:', userId);

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

          return res.json({ preferences });
        }
      } catch (dbError) {
        console.error('Error fetching preferences from DB:', dbError);
      }

      const defaultPreferences = {
        preferred_categories: [],
        content_weights: {},
        excluded_users: []
      };

      res.json({
        preferences: defaultPreferences
      });
    } catch (error) {
      console.error('Get user preferences error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ تحديث تفضيلات المستخدم
  async updateUserPreferences(req, res) {
    try {
      const userId = req.user.id;
      const { preferences } = req.body;

      console.log('🔄 Updating user preferences for:', userId, preferences);

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
            JSON.stringify(preferences.preferred_categories || []),
            JSON.stringify(preferences.content_weights || {}),
            JSON.stringify(preferences.excluded_users || [])
          ]
        );
      } catch (dbError) {
        console.error('Error saving preferences to DB:', dbError);
      }

      res.json({
        message: 'Preferences updated successfully',
        preferences: preferences
      });
    } catch (error) {
      console.error('Update user preferences error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ الحصول على إحصائيات المستخدم
  async getUserStats(req, res) {
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
  },

  // ✅ تحديث إعدادات الإشعارات
  async updateNotificationSettings(req, res) {
    try {
      const userId = req.user.id;
      const { notifications } = req.body;

      await pool.execute(
        `INSERT INTO user_preferences (user_id, notifications, updated_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         notifications = VALUES(notifications),
         updated_at = NOW()`,
        [userId, notifications !== undefined ? notifications : true]
      );

      res.json({
        success: true,
        message: 'Notification settings updated successfully'
      });
    } catch (error) {
      console.error('Update notification settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification settings'
      });
    }
  },

  // ==================== البحث والإكتشاف ====================

  // ✅ الحصول على المستخدمين المقترحين للمتابعة
  async getSuggestedUsers(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;

      const [suggestedUsers] = await pool.execute(
        `SELECT u.id, u.username, u.avatar, u.bio, u.followers_count,
                COUNT(DISTINCT f2.follower_id) as mutual_followers
         FROM users u
         LEFT JOIN followers f1 ON u.id = f1.following_id AND f1.follower_id = ?
         LEFT JOIN followers f2 ON u.id = f2.following_id 
                              AND f2.follower_id IN (SELECT following_id FROM followers WHERE follower_id = ?)
         WHERE f1.follower_id IS NULL 
           AND u.id != ? 
           AND u.is_banned = FALSE
         GROUP BY u.id
         ORDER BY mutual_followers DESC, u.followers_count DESC
         LIMIT ?`,
        [userId, userId, userId, limit]
      );

      res.json({
        success: true,
        data: suggestedUsers
      });
    } catch (error) {
      console.error('Get suggested users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get suggested users'
      });
    }
  },

  // ==================== الإدارة والأمان ====================

  // ✅ تغيير كلمة المرور
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      const [users] = await pool.execute(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = users[0];

      // التحقق من كلمة المرور الحالية
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // تشفير كلمة المرور الجديدة
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId]
      );

      console.log('✅ Password changed successfully for user:', userId);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password'
      });
    }
  },

  // ✅ إلغاء الحساب
  async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }

      const [users] = await pool.execute(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = users[0];

      // التحقق من كلمة المرور
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Password is incorrect'
        });
      }

      // تحديث الحساب بدلاً من حذفه (لحفظ البيانات)
      await pool.execute(
        'UPDATE users SET is_banned = TRUE, email = CONCAT(email, "_deleted_", UUID()), username = CONCAT(username, "_deleted_", UUID()) WHERE id = ?',
        [userId]
      );

      console.log('✅ Account deleted successfully for user:', userId);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  },

  // ✅ الحصول على نشاط المستخدم
  async getUserActivity(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const [activities] = await pool.execute(
        `SELECT 'like' as type, l.created_at as timestamp, v.id as video_id, v.title, v.thumbnail,
                u.id as target_user_id, u.username as target_username, u.avatar as target_avatar
         FROM likes l
         JOIN videos v ON l.video_id = v.id
         JOIN users u ON v.user_id = u.id
         WHERE l.user_id = ?
         
         UNION ALL
         
         SELECT 'follow' as type, f.created_at as timestamp, NULL as video_id, NULL as title, NULL as thumbnail,
                u.id as target_user_id, u.username as target_username, u.avatar as target_avatar
         FROM followers f
         JOIN users u ON f.following_id = u.id
         WHERE f.follower_id = ?
         
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`,
        [userId, userId, parseInt(limit), offset]
      );

      const [totalCount] = await pool.execute(
        `SELECT (
          (SELECT COUNT(*) FROM likes WHERE user_id = ?) +
          (SELECT COUNT(*) FROM followers WHERE follower_id = ?)
        ) as total`,
        [userId, userId]
      );

      res.json({
        success: true,
        data: activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount[0].total,
          pages: Math.ceil(totalCount[0].total / limit)
        }
      });
    } catch (error) {
      console.error('Get user activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user activity'
      });
    }
  },

  // ==================== الإشعارات ====================

  // ✅ الحصول على إشعارات المستخدم
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const [notifications] = await pool.execute(
        `SELECT * FROM notifications 
         WHERE user_id = ? 
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, parseInt(limit), offset]
      );

      const [totalCount] = await pool.execute(
        'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
        [userId]
      );

      res.json({
        success: true,
        data: notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount[0].total,
          pages: Math.ceil(totalCount[0].total / limit)
        }
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications'
      });
    }
  },

  // ✅ تحديد الإشعار كمقروء
  async markNotificationAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  },

  // ✅ تحديد جميع الإشعارات كمقروءة
  async markAllNotificationsAsRead(req, res) {
    try {
      const userId = req.user.id;

      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  },

  // ✅ حذف إشعار
  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      await pool.execute(
        'DELETE FROM notifications WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }
  },

  // ==================== البلوك والحظر ====================

  // ✅ حظر مستخدم
  async blockUser(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      if (parseInt(targetUserId) === userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot block yourself'
        });
      }

      await pool.execute(
        'INSERT IGNORE INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)',
        [userId, targetUserId]
      );

      res.json({
        success: true,
        message: 'User blocked successfully'
      });
    } catch (error) {
      console.error('Block user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to block user'
      });
    }
  },

  // ✅ إلغاء حظر مستخدم
  async unblockUser(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      await pool.execute(
        'DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
        [userId, targetUserId]
      );

      res.json({
        success: true,
        message: 'User unblocked successfully'
      });
    } catch (error) {
      console.error('Unblock user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unblock user'
      });
    }
  },

  // ✅ الحصول على قائمة المستخدمين المحظورين
  async getBlockedUsers(req, res) {
    try {
      const userId = req.user.id;

      const [blockedUsers] = await pool.execute(
        `SELECT bu.*, u.username, u.avatar
         FROM blocked_users bu
         JOIN users u ON bu.blocked_user_id = u.id
         WHERE bu.user_id = ?
         ORDER BY bu.created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        data: blockedUsers
      });
    } catch (error) {
      console.error('Get blocked users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get blocked users'
      });
    }
  },

  // ==================== دوال إضافية ====================

  // ✅ الحصول على إحصائيات التوصية
  async getRecommendationStats(req, res) {
    try {
      const userId = req.user.id;

      const [interactionCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM user_interactions WHERE user_id = ?',
        [userId]
      );

      const [watchHistoryCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM watch_history WHERE user_id = ?',
        [userId]
      );

      res.json({
        interactions: interactionCount[0].count,
        watchHistory: watchHistoryCount[0].count,
        modelUpdated: new Date()
      });
    } catch (error) {
      console.error('Get recommendation stats error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ تحديث إعدادات الخصوصية
  async updatePrivacySettings(req, res) {
    try {
      const userId = req.user.id;
      const { is_private, allow_dms, show_activity_status } = req.body;

      console.log('🔄 Updating privacy settings for user:', userId, {
        is_private,
        allow_dms,
        show_activity_status
      });

      // التحقق من وجود الحقول المطلوبة
      if (is_private === undefined || allow_dms === undefined || show_activity_status === undefined) {
        return res.status(400).json({
          success: false,
          message: 'All privacy settings are required'
        });
      }

      // تحديث إعدادات الخصوصية في قاعدة البيانات
      await pool.execute(
        `UPDATE users SET 
          is_private = ?, 
          allow_dms = ?, 
          show_activity_status = ? 
         WHERE id = ?`,
        [is_private, allow_dms, show_activity_status, userId]
      );

      console.log('✅ Privacy settings updated successfully for user:', userId);

      res.json({
        success: true,
        message: 'Privacy settings updated successfully'
      });
    } catch (error) {
      console.error('Update privacy settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update privacy settings'
      });
    }
  },

  // ✅ الحصول على إعدادات الخصوصية
  async getPrivacySettings(req, res) {
    try {
      const userId = req.user.id;

      const [users] = await pool.execute(
        'SELECT is_private, allow_dms, show_activity_status FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = users[0];

      res.json({
        success: true,
        data: {
          is_private: user.is_private || false,
          allow_dms: user.allow_dms || true,
          show_activity_status: user.show_activity_status || true
        }
      });
    } catch (error) {
      console.error('Get privacy settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get privacy settings'
      });
    }
  }
};