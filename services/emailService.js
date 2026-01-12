// server/services/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    // استخدام المتغيرات الصحيحة من .env
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false, // true إذا كان المنفذ 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Nojoom App'}" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #000; color: #fff; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; }
                .button { display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${process.env.APP_NAME || 'Nojoom App'}</h1>
                </div>
                <div class="content">
                    <h2>Hello ${user.username}!</h2>
                    <p>Thank you for signing up. Please verify your email address by clicking the button below:</p>
                    <p style="text-align: center;">
                        <a href="${verificationUrl}" class="button">Verify Email Address</a>
                    </p>
                    <p>If the button doesn't work, you can also copy and paste the following link in your browser:</p>
                    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
                    <p>This verification link will expire in 24 hours.</p>
                </div>
                <div class="footer">
                    <p>If you didn't create an account, please ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent to:', user.email);
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info)); // رابط المعاينة في Ethereal
      return true;
    } catch (error) {
      console.error('❌ Error sending verification email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Nojoom App'}" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #000; color: #fff; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; }
                .button { display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${process.env.APP_NAME || 'Nojoom App'}</h1>
                </div>
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>Hello ${user.username},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <p style="text-align: center;">
                        <a href="${resetUrl}" class="button">Reset Password</a>
                    </p>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                    <p>This reset link will expire in 1 hour.</p>
                </div>
                <div class="footer">
                    <p>If you're having trouble clicking the button, copy and paste the URL below into your web browser:</p>
                    <p><a href="${resetUrl}">${resetUrl}</a></p>
                </div>
            </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent to:', user.email);
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info)); // رابط المعاينة في Ethereal
      return true;
    } catch (error) {
      console.error('❌ Error sending password reset email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
