import express from 'express';
import { usersController } from '../controllers/usersController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadAvatar } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ==================== مسارات عامة (بدون مصادقة) ====================

// ✅ تسجيل الدخول
router.post('/login', usersController.login);

// ✅ إنشاء حساب مدير (للتطوير فقط)
router.post('/create-admin', usersController.createAdminIfNotExists);

// ==================== مسارات خاصة (تتطلب مصادقة) ====================

// ✅ الحصول على ملف تعريف مستخدم
router.get('/profile/:username', authenticateToken, usersController.getProfile);

// ✅ تحديث الملف الشخصي
router.put(
  '/profile',
  authenticateToken,
  uploadAvatar.single('avatar'),
  usersController.updateProfile
);

// ✅ تحديث الروابط الاجتماعية
router.put('/social-links', authenticateToken, usersController.updateSocialLinks);

// ✅ الحصول على الفيديوهات التي أعجب بها المستخدم
router.get('/liked-videos', authenticateToken, usersController.getLikedVideos);

// ✅ الحصول على فيديوهات المستخدم
router.get('/videos', authenticateToken, usersController.getUserVideos);

// ✅ الحصول على سجل المشاهدة
router.get('/watch-history', authenticateToken, usersController.getWatchHistory);

// ✅ حذف فيديو من سجل المشاهدة
router.delete('/watch-history/:videoId', authenticateToken, usersController.deleteWatchHistoryItem);

// ✅ مسح سجل المشاهدة بالكامل
router.delete('/watch-history', authenticateToken, usersController.clearWatchHistory);

// ✅ متابعة مستخدم
router.post('/follow/:userId', authenticateToken, usersController.followUser);

// ✅ إلغاء متابعة مستخدم
router.delete('/follow/:userId', authenticateToken, usersController.unfollowUser);

// ✅ الحصول على المتابعين (للمستخدم الحالي)
router.get('/followers', authenticateToken, usersController.getMyFollowers);

// ✅ الحصول على المتابَعين (للمستخدم الحالي)
router.get('/following', authenticateToken, usersController.getMyFollowing);

// ✅ التحقق من حالة المتابعة
router.get('/follow-status/:userId', authenticateToken, usersController.getFollowStatus);

// ✅ الحصول على تفضيلات المستخدم
router.get('/preferences', authenticateToken, usersController.getUserPreferences);

// ✅ تحديث تفضيلات المستخدم
router.put('/preferences', authenticateToken, usersController.updateUserPreferences);

// ✅ الحصول على إحصائيات المستخدم
router.get('/stats', authenticateToken, usersController.getUserStats);

// ✅ تحديث إعدادات الإشعارات
router.put('/notification-settings', authenticateToken, usersController.updateNotificationSettings);

// ✅ البحث عن مستخدمين
router.get('/search', authenticateToken, usersController.searchUsers);

// ✅ الحصول على المستخدمين المقترحين للمتابعة
router.get('/suggested-users', authenticateToken, usersController.getSuggestedUsers);

// ✅ تغيير كلمة المرور
router.put('/change-password', authenticateToken, usersController.changePassword);

// ✅ الحصول على نشاط المستخدم
router.get('/activity', authenticateToken, usersController.getUserActivity);

// ✅ الحصول على إشعارات المستخدم
router.get('/notifications', authenticateToken, usersController.getNotifications);

// ✅ تحديد الإشعار كمقروء
router.put('/notifications/:notificationId/read', authenticateToken, usersController.markNotificationAsRead);

// ✅ تحديد جميع الإشعارات كمقروءة
router.put('/notifications/read-all', authenticateToken, usersController.markAllNotificationsAsRead);

// ✅ حذف إشعار
router.delete('/notifications/:notificationId', authenticateToken, usersController.deleteNotification);

// ✅ حظر مستخدم
router.post('/block/:userId', authenticateToken, usersController.blockUser);

// ✅ إلغاء حظر مستخدم
router.delete('/block/:userId', authenticateToken, usersController.unblockUser);

// ✅ الحصول على قائمة المستخدمين المحظورين
router.get('/blocked-users', authenticateToken, usersController.getBlockedUsers);

// ✅ تسجيل تفاعل المستخدم مع الفيديو (like/dislike/watch)
router.post('/interaction', authenticateToken, usersController.userInteraction);

// ✅ تنزيل بيانات المستخدم
router.get('/download-data', authenticateToken, usersController.downloadUserData);

// ✅ حذف الحساب
router.delete('/account', authenticateToken, usersController.deleteAccount);

// ✅ الحصول على إعدادات الخصوصية
router.get('/privacy-settings', authenticateToken, usersController.getPrivacySettings);

// ✅ تحديث إعدادات الخصوصية
router.put('/privacy-settings', authenticateToken, usersController.updatePrivacySettings);

// ✅ تحديث المظهر واللغة
router.put('/appearance', authenticateToken, usersController.updateAppearance);

// ==================== مسارات ديناميكية (يجب أن تكون في النهاية) ====================

// ✅ الحصول على المتابعين لمستخدم معين
router.get('/:userId/followers', authenticateToken, usersController.getFollowers);

// ✅ الحصول على المتابَعين لمستخدم معين
router.get('/:userId/following', authenticateToken, usersController.getFollowing);

// ✅ الحصول على فيديوهات المستخدم (عام)
router.get('/:userId/videos', authenticateToken, usersController.getProfileVideos);

// ✅ الحصول على الإعجابات لمستخدم معين
router.get('/:userId/likes', authenticateToken, usersController.getLikes);

export default router;