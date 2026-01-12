import express from 'express';
import { reportController } from '../controllers/reportController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// مسارات تحتاج مصادقة فقط
router.use(authenticateToken);

// إنشاء بلاغ جديد
router.post('/video/:videoId', reportController.createReport);

// الحصول على بلاغات المستخدم
router.get('/my-reports', reportController.getMyReports);

// المسارات التي تحتاج صلاحية أدمن
router.use(requireAdmin);

// الحصول على جميع البلاغات
router.get('/', reportController.getReports);

// الحصول على بلاغ محدد
router.get('/:id', reportController.getReport);

// تحديث حالة البلاغ
router.patch('/:id/status', reportController.updateReportStatus);

// حذف الفيديو من خلال البلاغ
router.post('/:reportId/delete-video', reportController.deleteVideo);

// الاحتفاظ بالفيديو (رفض البلاغ)
router.post('/:reportId/keep-video', reportController.keepVideo);

export default router;