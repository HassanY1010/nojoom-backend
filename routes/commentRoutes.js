import express from 'express';
import { commentController } from '../controllers/commentController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==================== مسارات التعليقات ====================

// الحصول على تعليقات الفيديو (عام)
router.get('/videos/:videoId/comments', commentController.getComments);

// إضافة تعليق جديد (يتطلب مصادقة)
router.post('/videos/:videoId/comments', authenticateToken, commentController.postComment);

// تحديث تعليق (صاحب التعليق فقط)
router.put('/comments/:commentId', authenticateToken, commentController.updateComment);

// حذف تعليق (صاحب التعليق فقط)
router.delete('/comments/:commentId', authenticateToken, commentController.deleteComment);

// الإبلاغ عن تعليق (يتطلب مصادقة)
router.post('/comments/:commentId/report', authenticateToken, commentController.reportComment);

// الحصول على إحصائيات التعليق
router.get('/comments/:commentId/stats', commentController.getCommentStats);

export default router;