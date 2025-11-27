import express from 'express';
import { videoController } from '../controllers/videoController.js';
import { commentController } from '../controllers/commentController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ==================== مسارات المشاركة الجديدة ====================

// ✅ تسجيل مشاركة الفيديو
router.post('/:videoId/share', authenticateToken, videoController.addShare);

// ✅ الحصول على عدد المشاركات
router.get('/:videoId/shares/count', videoController.getShareCount);

// ==================== مسارات جديدة ====================

// ✅ الحصول على فيديوهات المستخدم مع الفرز
router.get('/user/:userId', videoController.getUserVideos);

// ✅ تسجيل مشاهدة الفيديو
router.post('/:videoId/view', authenticateToken, videoController.addView);

// ==================== مسارات خاصة / مصادقة ====================

// مسارات المستخدم
router.get('/user/video', authenticateToken, videoController.getUserVideo);
router.get('/user/liked', authenticateToken, videoController.getLikedVideos);
router.post('/upload', authenticateToken, upload.single('video'), videoController.uploadVideo);
router.delete('/:id', authenticateToken, videoController.deleteVideo);

// مسارات الإعجاب
router.post('/:videoId/like', authenticateToken, videoController.likeVideo);
router.delete('/:videoId/like', authenticateToken, videoController.unlikeVideo);

// ========== مسارات نظام التوصية الجديدة ==========
router.get('/recommended', authenticateToken, videoController.getRecommendedVideos);
router.get('/following', authenticateToken, videoController.getFollowingVideos);
router.post('/user/watch-history', authenticateToken, videoController.recordWatchHistory);
router.post('/user/interaction', authenticateToken, videoController.recordInteraction);

// ========== ✅ مسارات التعليقات الجديدة ==========
router.get('/:videoId/comments', commentController.getComments);
router.post('/:videoId/comments', authenticateToken, commentController.postComment);
router.get('/:videoId/comments/count', videoController.getCommentCount);

// ==================== 🚀 VIDEO TURBO ENGINE ROUTES ====================

// الحصول على manifest file (HLS)
router.get('/:videoId/manifest', videoController.getManifest);

// الحصول على chunk محدد
router.get('/:videoId/chunk/:quality/:index', videoController.getChunk);

// الحصول على حالة معالجة الفيديو
router.get('/:videoId/processing-status', videoController.getProcessingStatus);

// الحصول على تقدم المشاهدة
router.get('/:videoId/progress', authenticateToken, videoController.getVideoProgress);

// حفظ تقدم المشاهدة
router.post('/:videoId/progress', authenticateToken, videoController.saveVideoProgress);

// الحصول على الفيديوهات غير المكتملة (للاستئناف)
router.get('/user/incomplete', authenticateToken, videoController.getIncompleteVideos);

// ==================== مسارات عامة / بدون مصادقة ====================
router.get('/', videoController.getVideos);
router.get('/:id', videoController.getVideo);

export default router;