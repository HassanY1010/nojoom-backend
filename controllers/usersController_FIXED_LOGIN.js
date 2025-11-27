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
                { expiresIn: jwtConfig.expiresIn }
            );

            const refreshToken = jwt.sign(
                {
                    id: user.id,
                    role: user.role
                },
                jwtConfig.refreshSecret,
                { expiresIn: jwtConfig.refreshExpiresIn }
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

};
