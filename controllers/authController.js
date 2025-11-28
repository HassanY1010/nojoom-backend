import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { jwtConfig } from '../config/jwt.js';
import { pool } from '../config/db.js';
import { emailService } from '../services/emailService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendEmail } from "../utils/sendEmail.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const authController = {

  async sendVerificationCode(req, res) {
    const { email, code } = req.body;

    await sendEmail({
      to: email,
      subject: "Your Nojoom Verification Code",
      html: `
      <h1>Your Verification Code</h1>
      <p>Your code is: <b>${code}</b></p>
      <p>This code will expire in 5 minutes.</p>
    `
    });

    res.json({ success: true, message: "Verification email sent" });
  },
  async checkUsername(req, res) {
    try {
      const { username } = req.body;

      if (!username || username.length < 3) {
        return res.status(400).json({
          error: 'Username must be at least 3 characters long'
        });
      }

      console.log('🔍 Checking username availability:', username);

      // التحقق من وجود اسم المستخدم
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );

      const isAvailable = existingUsers.length === 0;

      if (isAvailable) {
        return res.json({
          available: true,
          message: 'Username is available'
        });
      } else {
        // توليد اقتراحات بديلة
        const suggestions = await authController.generateUsernameSuggestions(username);

        return res.json({
          available: false,
          message: 'Username is already taken',
          suggestions: suggestions.slice(0, 3) // إرجاع 3 اقتراحات فقط
        });
      }

    } catch (error) {
      console.error('❌ Check username error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async generateUsernameSuggestions(baseUsername) {
    try {
      const suggestions = [];
      const suffixes = ['', '1', '2', '3', '2024', 'official', 'real', 'tv', 'world', 'live'];
      const prefixes = ['the', 'real', 'official', 'mr', 'ms'];

      // إضافة أرقام
      for (let i = 1; i <= 100; i++) {
        const suggestion = `${baseUsername}${i}`;
        const [existing] = await pool.execute(
          'SELECT id FROM users WHERE username = ?',
          [suggestion]
        );
        if (existing.length === 0) {
          suggestions.push(suggestion);
          if (suggestions.length >= 10) break;
        }
      }

      // إضافة suffixes
      for (const suffix of suffixes) {
        if (suggestions.length >= 10) break;
        const suggestion = suffix ? `${baseUsername}_${suffix}` : baseUsername;
        const [existing] = await pool.execute(
          'SELECT id FROM users WHERE username = ?',
          [suggestion]
        );
        if (existing.length === 0 && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }

      // إضافة prefixes
      for (const prefix of prefixes) {
        if (suggestions.length >= 10) break;
        const suggestion = `${prefix}_${baseUsername}`;
        const [existing] = await pool.execute(
          'SELECT id FROM users WHERE username = ?',
          [suggestion]
        );
        if (existing.length === 0 && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }

      // توليد أسماء عشوائية إذا لم يكن هناك اقتراحات كافية
      if (suggestions.length < 3) {
        const randomSuffixes = ['fan', 'lover', 'king', 'queen', 'star', 'pro', 'max', 'plus'];
        for (const suffix of randomSuffixes) {
          if (suggestions.length >= 10) break;
          const suggestion = `${baseUsername}_${suffix}`;
          const [existing] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [suggestion]
          );
          if (existing.length === 0 && !suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
        }
      }

      return suggestions.slice(0, 10); // إرجاع حتى 10 اقتراحات

    } catch (error) {
      console.error('❌ Error generating username suggestions:', error);
      return [];
    }
  },

  async register(req, res) {
    try {
      const { username, email, password, bio = '', birthDate, birthDay, birthMonth, birthYear } = req.body;
      const avatarFile = req.file;

      console.log('📝 Registration attempt:', {
        username,
        email,
        bio,
        birthDate,
        birthDay,
        birthMonth,
        birthYear,
        hasAvatar: !!avatarFile
      });

      // ✅ Validation - التحقق من الحقول المطلوبة
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email and password are required' });
      }

      // ✅ التحقق من وجود birthDate أو birthDay/birthMonth/birthYear
      if (!birthDate && (!birthDay || !birthMonth || !birthYear)) {
        return res.status(400).json({ error: 'Birth date is required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Validate username length
      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters long' });
      }

      // ✅ معالجة تاريخ الميلاد
      let finalBirthDate = birthDate;
      if (!finalBirthDate && birthDay && birthMonth && birthYear) {
        finalBirthDate = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;
      }

      // Validate birth date
      const birthDateObj = new Date(finalBirthDate);
      if (isNaN(birthDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid birth date' });
      }

      // Check age (must be at least 13 years old)
      const today = new Date();
      const age = today.getFullYear() - birthDateObj.getFullYear();
      const hasBirthdayPassed = today.getMonth() > birthDateObj.getMonth() ||
        (today.getMonth() === birthDateObj.getMonth() && today.getDate() >= birthDateObj.getDate());

      const actualAge = hasBirthdayPassed ? age : age - 1;

      if (actualAge < 13) {
        return res.status(400).json({ error: 'You must be at least 13 years old to register' });
      }

      // استخراج أجزاء التاريخ إذا لم تكن موجودة
      const finalBirthDay = birthDay || birthDateObj.getDate();
      const finalBirthMonth = birthMonth || (birthDateObj.getMonth() + 1);
      const finalBirthYear = birthYear || birthDateObj.getFullYear();

      // Check if user exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Check if username exists
      const [existingUsername] = await pool.execute(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );
      if (existingUsername.length > 0) {
        // توليد اقتراحات بديلة
        const suggestions = await authController.generateUsernameSuggestions(username);
        return res.status(400).json({
          error: 'Username already taken',
          suggestions: suggestions.slice(0, 3)
        });
      }

      // ✅ Handle avatar upload
      let avatarPath = '/uploads/avatars/default-avatar.png';
      if (avatarFile) {
        avatarPath = `/uploads/avatars/${avatarFile.filename}`;
        console.log('✅ Avatar uploaded:', avatarPath);
      }

      // ✅ Create user with all data including bio and avatar - استخدام الدالة المعدلة
      const userId = await User.create({
        username,
        email,
        password,
        avatar: avatarPath, // ✅ تمرير مسار الصورة
        bio: bio, // ✅ تمرير الـ bio
        birthDate: finalBirthDate,
        birthDay: parseInt(finalBirthDay),
        birthMonth: parseInt(finalBirthMonth),
        birthYear: parseInt(finalBirthYear)
      });

      console.log('✅ User created with ID:', userId, 'Bio:', bio, 'Avatar:', avatarPath);

      // Get user data
      const user = await User.findById(userId);

      // Generate tokens
      const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        jwtConfig.refreshSecret,
        { expiresIn: jwtConfig.refreshExpiresIn }
      );

      // Save refresh token to database
      await pool.execute(
        'INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)',
        [user.id, refreshToken]
      );

      // Send verification email
      try {
        await authController.sendVerificationEmailInternal(user);
      } catch (emailError) {
        console.error('❌ Failed to send verification email:', emailError);
        // Continue without failing the registration
      }

      res.status(201).json({
        message: 'User registered successfully. Please check your email for verification.',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio, // ✅ إرجاع الـ bio
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme
        },
        accessToken,
        refreshToken
      });

    } catch (error) {
      console.error('❌ Registration error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

async createAdminIfNotExists(req, res) {
    try {
      // Check if admin exists
      const [admin] = await pool.execute(
        'SELECT * FROM users WHERE role = "admin"'
      );

      if (admin.length > 0) {
        return res.json({ message: "Admin already exists" });
      }

      // Create encrypted password for admin
      const passwordHash = await bcrypt.hash("admin123", 10);
      const defaultBirthDate = "1990-01-01";

      // Create admin in database
      await pool.execute(
        "INSERT INTO users (username, email, password, role, birth_date, birth_day, birth_month, birth_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["admin", "admin@example.com", passwordHash, "admin", defaultBirthDate, 1, 1, 1990]
      );

      res.json({ message: "Admin user created successfully" });
    } catch (error) {
      console.error("❌ Create admin error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },


  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await User.findByEmail(email);

      // إذا لم يتم العثور على مستخدم
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      let isMatch = false;

      // 🔥 المدير → كلمة مروره غير مشفرة نهائياً
      if (user.role === 'admin') {
        isMatch = password === user.password;
      }
      // باقي المستخدمين → يستخدمون bcrypt
      else {
        isMatch = await User.validatePassword(password, user.password);
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // // ✅ التحقق من تفعيل البريد الإلكتروني (ما عدا المدير)
      // if (user.role !== 'admin' && !user.email_verified) {
      //   return res.status(403).json({
      //     error: 'Email not verified',
      //     message: 'Please verify your email before logging in',
      //     email: user.email,
      //     emailVerified: false
      //   });
      // }



      // Generate tokens
      const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        jwtConfig.refreshSecret,
        { expiresIn: jwtConfig.refreshExpiresIn }
      );

      // Save refresh token to database
      await pool.execute(
        'INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)',
        [user.id, refreshToken]
      );

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          followers_count: user.followers_count,
          following_count: user.following_count,
          likes_count: user.likes_count,
          views_count: user.views_count,
          social_links: user.social_links
        },
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async refreshToken(req, res) {
    try {
      // Check if user exists in request (from middleware)
      if (!req.user || !req.user.id) {
        console.log('❌ No user in refresh token request');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      console.log('🔄 Refreshing token for user ID:', userId);

      // Get user data from database
      const user = await User.findById(userId);

      if (!user) {
        console.log('❌ User not found for refresh token:', userId);
        return res.status(404).json({ error: 'User not found' });
      }

      // Create new access token
      const newAccessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      console.log('✅ Token refreshed for user:', user.username);

      res.json({
        accessToken: newAccessToken,
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getProfile(req, res) {
    try {
      // Check if user exists in request
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      console.log('📋 Fetching profile for user ID:', userId);

      // Get user data from database
      const user = await User.findById(userId);

      if (!user) {
        console.log('❌ User not found for ID:', userId);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('✅ Profile found for user:', user.username);

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio || '',
        birthDate: user.birthDate || '',
        birthDay: user.birthDay || '',
        birthMonth: user.birthMonth || '',
        birthYear: user.birthYear || '',
        role: user.role,
        email_verified: user.email_verified,
        language: user.language,
        theme: user.theme,
        followers_count: user.followers_count || 0,
        following_count: user.following_count || 0,
        likes_count: user.likes_count || 0,
        views_count: user.views_count || 0,
        social_links: user.social_links,
        created_at: user.created_at
      });

    } catch (error) {
      console.error('❌ Get profile error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async logout(req, res) {
    try {
      const refreshToken = req.headers['refresh-token'] || req.body.refreshToken;

      if (refreshToken) {
        // Delete refresh token from database
        await pool.execute(
          'DELETE FROM refresh_tokens WHERE token = ?',
          [refreshToken]
        );
        console.log('✅ Refresh token deleted for logout');
      }

      res.json({ message: 'Logout successful' });

    } catch (error) {
      console.error('❌ Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateProfile(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { username, bio, birthDate, birthDay, birthMonth, birthYear } = req.body;
      const avatarFile = req.file;

      console.log('🔄 Update profile request:', {
        userId, username, bio, birthDate, birthDay, birthMonth, birthYear, hasAvatar: !!avatarFile
      });

      // Validation
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }

      // Validate username length
      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters long' });
      }

      // ✅ معالجة تاريخ الميلاد
      let finalBirthDate = birthDate;
      if (!finalBirthDate && birthDay && birthMonth && birthYear) {
        finalBirthDate = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;
      }

      // Validate birth date if provided
      if (finalBirthDate) {
        const birthDateObj = new Date(finalBirthDate);
        if (isNaN(birthDateObj.getTime())) {
          return res.status(400).json({ error: 'Invalid birth date' });
        }

        // Check age (must be at least 13 years old)
        const today = new Date();
        const age = today.getFullYear() - birthDateObj.getFullYear();
        const hasBirthdayPassed = today.getMonth() > birthDateObj.getMonth() ||
          (today.getMonth() === birthDateObj.getMonth() && today.getDate() >= birthDateObj.getDate());

        const actualAge = hasBirthdayPassed ? age : age - 1;

        if (actualAge < 13) {
          return res.status(400).json({ error: 'You must be at least 13 years old' });
        }
      }

      // Check if username is taken by another user
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );

      if (existingUsers.length > 0) {
        // توليد اقتراحات بديلة
        const suggestions = await authController.generateUsernameSuggestions(username);
        return res.status(400).json({
          error: 'Username already taken',
          suggestions: suggestions.slice(0, 3)
        });
      }

      // ✅ Prepare update data مع تضمين الـ bio
      const updateData = {
        username,
        bio: bio || '', // ✅ التأكد من حفظ الـ bio
        birthDate: finalBirthDate,
        birthDay: birthDay ? parseInt(birthDay) : null,
        birthMonth: birthMonth ? parseInt(birthMonth) : null,
        birthYear: birthYear ? parseInt(birthYear) : null
      };

      if (avatarFile) {
        updateData.avatar = `/uploads/avatars/${avatarFile.filename}`;
      }

      // Update user in database
      const success = await User.updateProfile(userId, updateData);

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get updated user data
      const user = await User.findById(userId);

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio, // ✅ إرجاع الـ bio
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          social_links: user.social_links
        }
      });

    } catch (error) {
      console.error('❌ Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateSocialLinks(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { social_links } = req.body;

      console.log('🔄 Updating social links for user:', userId, { social_links });

      if (!social_links) {
        return res.status(400).json({ error: 'Social links data is required' });
      }

      // Validate JSON format
      try {
        JSON.parse(social_links);
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid social links format' });
      }

      const success = await User.updateSocialLinks(userId, social_links);

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get updated user data
      const user = await User.findById(userId);

      res.json({
        message: 'Social links updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          social_links: user.social_links
        }
      });

    } catch (error) {
      console.error('❌ Update social links error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async updatePreferences(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { language, theme } = req.body;

      console.log('🔄 Updating preferences for user:', userId, { language, theme });

      // Validation
      if (!language || !theme) {
        return res.status(400).json({ error: 'Language and theme are required' });
      }

      if (!['en', 'ar'].includes(language)) {
        return res.status(400).json({ error: 'Invalid language' });
      }

      if (!['light', 'dark'].includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme' });
      }

      const success = await User.updatePreferences(userId, { language, theme });

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get updated user data
      const user = await User.findById(userId);

      res.json({
        message: 'Preferences updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          social_links: user.social_links
        }
      });

    } catch (error) {
      console.error('❌ Update preferences error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async updatePrivacySettings(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { is_private, allow_dms, show_activity_status } = req.body;

      console.log('🔄 Updating privacy settings for user:', userId, { is_private, allow_dms, show_activity_status });

      if (
        typeof is_private === 'undefined' ||
        typeof allow_dms === 'undefined' ||
        typeof show_activity_status === 'undefined'
      ) {
        return res.status(400).json({ error: 'Missing privacy settings' });
      }

      const success = await User.updatePrivacySettings(userId, { is_private, allow_dms, show_activity_status });

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'Privacy settings updated successfully' });
    } catch (error) {
      console.error('❌ Update privacy settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async changePassword(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      // Get current user password
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await User.validatePassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Update password
      await User.updatePassword(userId, newPassword);

      res.json({ message: 'Password changed successfully' });

    } catch (error) {
      console.error('❌ Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async sendVerificationEmail(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.email_verified) {
        return res.status(400).json({ error: 'Email is already verified' });
      }

      const emailSent = await authController.sendVerificationEmailInternal(user);

      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email' });
      }

      res.json({ message: 'Verification email sent successfully' });

    } catch (error) {
      console.error('❌ Send verification email error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async sendVerificationEmailInternal(user) {
    try {
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Delete any existing tokens for this user
      await pool.execute(
        'DELETE FROM email_verification_tokens WHERE user_id = ?',
        [user.id]
      );

      // Save new token to database
      await pool.execute(
        'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, verificationToken, expiresAt]
      );

      // Send verification email
      const emailSent = await emailService.sendVerificationEmail(user, verificationToken);

      if (emailSent) {
        console.log('✅ Verification email sent to:', user.email);
        return true;
      } else {
        console.error('❌ Failed to send verification email to:', user.email);
        return false;
      }
    } catch (error) {
      console.error('❌ Error in sendVerificationEmailInternal:', error);
      return false;
    }
  },

  async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
      }

      // Find the token in database
      const [tokens] = await pool.execute(
        'SELECT * FROM email_verification_tokens WHERE token = ? AND expires_at > NOW()',
        [token]
      );

      if (tokens.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      const verificationToken = tokens[0];

      // Update user's email verification status
      const success = await User.setEmailVerified(verificationToken.user_id);

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete the used token
      await pool.execute(
        'DELETE FROM email_verification_tokens WHERE token = ?',
        [token]
      );

      // Get updated user data
      const user = await User.findById(verificationToken.user_id);

      res.json({
        message: 'Email verified successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          social_links: user.social_links
        }
      });

    } catch (error) {
      console.error('❌ Verify email error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async deleteAccount(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Password is required to delete account' });
      }

      // Verify password
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isValidPassword = await User.validatePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Password is incorrect' });
      }

      // Delete account
      const success = await User.deleteAccount(userId);

      if (!success) {
        return res.status(500).json({ error: 'Failed to delete account' });
      }

      // Delete all refresh tokens for this user
      await pool.execute(
        'DELETE FROM refresh_tokens WHERE user_id = ?',
        [userId]
      );

      // Delete all verification tokens for this user
      await pool.execute(
        'DELETE FROM email_verification_tokens WHERE user_id = ?',
        [userId]
      );

      console.log('✅ Account deleted for user ID:', userId);

      res.json({ message: 'Account deleted successfully' });

    } catch (error) {
      console.error('❌ Delete account error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async checkEmailVerification(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        email_verified: user.email_verified,
        email: user.email
      });

    } catch (error) {
      console.error('❌ Check email verification error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};
