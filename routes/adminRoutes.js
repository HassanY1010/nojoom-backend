import express from 'express';
import adminController from '../controllers/adminController.js';
import reportController from '../controllers/reportController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ Middleware للتحقق من التوكن وصلاحية المدير
router.use(authenticateToken, requireAdmin);

// ================= إدارة المستخدمين =================
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id', adminController.updateUser);
router.post('/users/:id/ban', adminController.banUser);
router.post('/users/:id/unban', adminController.unbanUser);
router.delete('/users/:id', adminController.deleteUser);

// ================= إدارة الفيديوهات =================
router.get('/videos', adminController.getVideos);
router.get('/videos/:id', adminController.getVideo);
router.delete('/videos/:id', adminController.deleteVideoAdmin);
router.post('/videos/:id/pin', adminController.pinVideo);
router.post('/videos/:id/unpin', adminController.unpinVideo);
router.get('/videos/pinned/all', adminController.getPinnedVideos);
router.get('/videos/most-viewed', adminController.getMostViewedVideos);

// ================= البلاغات =================
// ✅ إحصائيات البلاغات (يجب أن تسبق المسارات التي تحتوي على معاملات)
router.get('/reports/stats', reportController.getReportsStats);

router.get('/reports', reportController.getReports);
router.get('/reports/:id', reportController.getReport);
router.patch('/reports/:id/status', reportController.updateReportStatus);
router.post('/reports/:reportId/delete-video', reportController.deleteVideo);
router.post('/reports/:reportId/keep-video', reportController.keepVideo);
router.post('/reports/:reportId/ban-user', reportController.banUserFromReport);

// ================= البث والإحصائيات =================
router.post('/broadcast', adminController.sendBroadcast);
router.get('/broadcasts', adminController.getBroadcasts);
router.get('/stats', adminController.getStats);

// ================= التحكم في النظام =================
router.get('/system-settings', adminController.getSystemSettings);
router.put('/system-settings', adminController.updateSystemSettings);

export default router;
