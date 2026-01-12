import db from "../config/db.js";
import bcrypt from "bcrypt";
import { sendEmail } from "../utils/sendEmail.js";

/**
 * 1️⃣ إرسال رمز إعادة تعيين كلمة المرور
 */
export const sendResetCode = async (req, res) => {
  const { email } = req.body;

  try {
    // التحقق من وجود المستخدم
    const [user] = await db.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (user.length === 0) {
      return res.status(400).json({ message: "Email not found" });
    }

    // توليد كود 6 أرقام
    const code = Math.floor(100000 + Math.random() * 900000);

    // حفظ الكود في قاعدة البيانات مع انتهاء صلاحية 10 دقائق
    await db.execute(
      "INSERT INTO reset_codes (email, code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
      [email, code]
    );

    // إرسال الكود عبر البريد الإلكتروني
    await sendEmail({
      to: email,
      subject: "Reset Your Password",
      html: `
        <h1>Your Reset Code</h1>
        <p>Your reset code is: <b>${code}</b></p>
        <p>This code will expire in 10 minutes.</p>
      `
    });

    res.json({ message: "Reset code sent to email" });
  } catch (error) {
    console.error("Error sending reset code:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * 2️⃣ التحقق من رمز إعادة التعيين
 */
export const verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM reset_codes WHERE email = ? AND code = ? AND expires_at > NOW()",
      [email, code]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    res.json({ message: "Code verified" });
  } catch (error) {
    console.error("Error verifying reset code:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * 3️⃣ تغيير كلمة المرور
 */
export const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    // التحقق من صحة الكود مرة أخرى
    const [rows] = await db.execute(
      "SELECT * FROM reset_codes WHERE email = ? AND code = ? AND expires_at > NOW()",
      [email, code]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // تشفير كلمة المرور الجديدة
    const hashed = await bcrypt.hash(newPassword, 10);

    // تحديث كلمة المرور في جدول المستخدمين
    await db.execute(
      "UPDATE users SET password = ? WHERE email = ?",
      [hashed, email]
    );

    // حذف الكود بعد الاستخدام
    await db.execute(
      "DELETE FROM reset_codes WHERE email = ?",
      [email]
    );

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Server error" });
  }
};
