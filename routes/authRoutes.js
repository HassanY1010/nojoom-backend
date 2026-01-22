//ملف authRoutes.js
import express from 'express';
import { authController } from '../controllers/authController.js';
import { uploadAvatar } from '../middleware/uploadMiddleware.js';
import { authenticateToken, refreshTokenMiddleware } from '../middleware/authMiddleware.js';
import { registerValidation, loginValidation } from '../middleware/validationMiddleware.js';
import { sendVerificationCode } from "../utils/sendEmail.js";
import { pool } from '../config/db.js';


const router = express.Router();

// =======================
// AUTHENTICATION ROUTES
// =======================


// تسجيل مستخدم جديد مع رفع صورة
router.post('/register', uploadAvatar.single('avatar'), registerValidation, authController.register);

router.post('/check-username', authController.checkUsername);

// تسجيل الدخول
router.post('/login', loginValidation, authController.login);

// تجديد الـ token
router.post('/refresh', authController.refreshToken);

// التحقق من الـ token (محمي)
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user,
    message: 'Token is valid'
  });
});

// تسجيل الخروج (محمي)
router.post('/logout', authenticateToken, authController.logout);


// إرسال OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email required" });

    // التحقق هل المستخدم موجود
    const [user] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (user.length === 0) return res.status(404).json({ message: "User not found" });

    // حماية ضد Spam: السماح بطلب OTP كل 1 دقيقة فقط
    if (user[0].otp_expires) {
      const lastRequest = new Date(user[0].otp_expires);
      const now = new Date();
      const diff = (now - lastRequest) / 1000 / 60; // بالدقائق

      if (diff < -9.5) {
        return res.status(429).json({
          message: "Please wait before requesting another code",
        });
      }
    }

    // توليد كود 6 أرقام
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // وقت انتهاء الكود (10 دقائق)
    const expires = new Date(Date.now() + 10 * 60000);

    // حفظ الكود في MySQL
    await pool.query(
      "UPDATE users SET otp_code = ?, otp_expires = ? WHERE email = ?",
      [code, expires, email]
    );

    // إرسال الكود
    await sendVerificationCode(email, code);

    res.json({ success: true, message: "OTP sent successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code)
      return res.status(400).json({ message: "Email and code required" });

    const [user] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

    if (user.length === 0)
      return res.status(404).json({ message: "User not found" });

    const validUser = user[0];

    // التحقق من الكود
    if (validUser.otp_code !== code)
      return res.status(400).json({ message: "Invalid code" });

    // التحقق من انتهاء الكود
    const now = new Date();
    const expires = new Date(validUser.otp_expires);

    if (now > expires)
      return res.status(400).json({ message: "Code expired" });

    // تنظيف الكود بعد التحقق
    await pool.query(
      "UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE email = ?",
      [email]
    );

    res.json({ success: true, message: "Verification successful" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// USER PROFILE ROUTES
// =======================

// الحصول على بيانات الملف الشخصي (محمي)
router.get('/profile', authenticateToken, authController.getProfile);

// تحديث الملف الشخصي (محمي) مع رفع صورة
router.put('/profile', authenticateToken, uploadAvatar.single('avatar'), authController.updateProfile);

// تحديث الروابط الاجتماعية
router.put('/social-links', authenticateToken, authController.updateSocialLinks);

// تحديث التفضيلات
router.put('/preferences', authenticateToken, authController.updatePreferences);

// تغيير كلمة المرور
router.put('/change-password', authenticateToken, authController.changePassword);

// إرسال بريد التحقق
router.post('/send-verification-email', authenticateToken, authController.sendVerificationEmail);

// التحقق من البريد الإلكتروني
router.post('/verify-email', authController.verifyEmail);

// حذف الحساب
router.delete('/account', authenticateToken, authController.deleteAccount);

export default router;
