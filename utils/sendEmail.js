import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

// التحقق من وجود API Key
if (!process.env.RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY is missing in .env file");
}

const resend = new Resend(process.env.RESEND_API_KEY);

// دالة لإرسال أي رسالة
export const sendEmail = async (to, subject, htmlContent) => {
  try {
    const response = await resend.emails.send({
      from: process.env.SENDER_EMAIL || 'onboarding@resend.dev',
      to: to,
      subject: subject,
      html: htmlContent,
    });

    if (response.error) {
      console.error("❌ Resend API Error:", response.error);
      // معالجة خطأ النطاق التجريبي
      if (response.error.message?.includes('only send testing emails to your own email')) {
        console.warn("⚠️ تنبيه: أنت في وضع الاختبار في Resend. يمكنك الإرسال فقط إلى بريدك المسجل لديهم.");
      }
      throw response.error;
    }

    console.log(`✅ Email sent successfully to ${to}`);
    return response;

  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    throw error;
  }
};

// دالة جاهزة لإرسال كود OTP
export const sendVerificationCode = async (email, code) => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #333;">Verify Your Email</h2>
      <p style="font-size: 16px; color: #555;">Use the code below to verify your account on Nojoom:</p>
      <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <h1 style="color: #4F46E5; margin: 0; letter-spacing: 5px; font-size: 32px;">${code}</h1>
      </div>
      <p style="font-size: 14px; color: #888;">This code will expire in 10 minutes.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #aaa; text-align: center;">If you didn't request this, please ignore this email.</p>
    </div>
  `;

  return await sendEmail(email, "Your Verification Code - Nojoom", htmlContent);
};
