import express from 'express';
import { videoController } from '../controllers/videoController.js';
import { commentController } from '../controllers/commentController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ============================================================
// 🟦 1) مسارات المشاركة (SHARES)
// ============================================================

// تسجيل مشاركة الفيديو
router.post('/:videoId/share', authenticateToken, videoController.addShare);

// عدد مشاركات فيديو
router.get('/:videoId/shares/count', videoController.getShareCount);

// ============================================================
// 🟩 2) مسارات المشاهدات (VIEWS)
// ============================================================

// تسجيل مشاهدة
router.post('/:videoId/view', authenticateToken, videoController.addView);

// ============================================================
// 🟨 3) مسارات المستخدم USER VIDEO ROUTES
// ============================================================

// جميع فيديوهات مستخدم
router.get('/user/:userId', videoController.getUserVideos);

// فيديو واحد يخص المستخدم
router.get('/user/video', authenticateToken, videoController.getUserVideo);

// فيديوهات أعجب بها المستخدم
router.get('/user/liked', authenticateToken, videoController.getLikedVideos);

// فيديوهات غير مكتملة
router.get('/user/incomplete', authenticateToken, videoController.getIncompleteVideos);

// مسارات watch history و interaction
router.post('/user/watch-history', authenticateToken, videoController.recordWatchHistory);
router.post('/user/interaction', authenticateToken, videoController.recordInteraction);

// ============================================================
// 🟥 4) الرفع والحذف Upload / Delete
// ============================================================

// رفع فيديو
router.post(
  '/upload',
  authenticateToken,
  upload.single('video'),
  videoController.uploadVideo
);

// حذف فيديو
router.delete('/:id', authenticateToken, videoController.deleteVideo);

// ============================================================
// 🟧 5) الإعجاب LIKE SYSTEM
// ============================================================

// إعجاب
router.post('/:videoId/like', authenticateToken, videoController.likeVideo);

// إزالة الإعجاب
router.delete('/:videoId/like', authenticateToken, videoController.unlikeVideo);

// ============================================================
// 🟦 6) نظام التوصية RECOMMENDATION ENGINE
// ============================================================

// ضع المسارات الثابتة قبل أي مسار ديناميكي
router.get('/recommended', authenticateToken, videoController.getRecommendedVideos);
router.get('/following', authenticateToken, videoController.getFollowingVideos);

// ============================================================
// 🟪 7) التعليقات COMMENTS
// ============================================================

// جميع التعليقات
router.get('/:videoId/comments', commentController.getComments);

// إضافة تعليق
router.post('/:videoId/comments', authenticateToken, commentController.postComment);

// عدد التعليقات
router.get('/:videoId/comments/count', videoController.getCommentCount);

// ============================================================
// 🔥 8) VIDEO TURBO ENGINE (HLS / CHUNKS)
// ============================================================

// ملف manifest.m3u8
router.get('/:videoId/manifest', videoController.getManifest);

// ملف chunk.ts
router.get('/:videoId/chunk/:quality/:index', videoController.getChunk);

// حالة معالجة الفيديو
router.get('/:videoId/processing-status', videoController.getProcessingStatus);

// ============================================================
// 🟨 9) Video Progress (حفظ التقدم)
// ============================================================

router.get('/:videoId/progress', authenticateToken, videoController.getVideoProgress);
router.post('/:videoId/progress', authenticateToken, videoController.saveVideoProgress);

// ============================================================
// 🟩 10) مسارات عامة PUBLIC ROUTES
// ============================================================

// 🔧 الإصلاح: إضافة معالج الدالة المفقود للسطر 117
router.get('/', (req, res) => {
  // يمكنك إما استدعاء videoController.getVideos مباشرة
  // أو إعادة توجيه إلى الدالة المناسبة
  videoController.getVideos(req, res);
});

// مسار الفيديو بالـ ID يجب أن يكون آخر شيء
router.get('/:id', videoController.getVideo);

export default router;