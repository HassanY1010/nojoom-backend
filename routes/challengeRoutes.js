import express from 'express';
import { challengeController } from '../controllers/challengeController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ============ Public Routes ============
// الحصول على التحديات النشطة (متاح للجميع)
router.get('/active', challengeController.getActiveChallenges);

// الحصول على التحديات السابقة (متاح للجميع)
router.get('/past', challengeController.getPastChallenges);

// الحصول على تفاصيل تحدي محدد (متاح للجميع)
router.get('/:id', challengeController.getChallengeById);

// الحصول على مشاركات التحدي (متاح للجميع)
router.get('/:id/entries', challengeController.getChallengeEntries);

// ============ Protected Routes ============
// إضافة مشاركة في التحدي (يتطلب تسجيل دخول)
router.post('/:id/submit', authenticateToken, challengeController.submitEntry);

// الحصول على أوسمة المستخدم (يتطلب تسجيل دخول)
router.get('/user/badges', authenticateToken, challengeController.getUserBadges);

// ============ Admin Routes ============
// إنشاء تحديات أسبوعية (Admin فقط)
router.post('/admin/create-weekly', authenticateToken, challengeController.createWeeklyChallenges);

// إنهاء التحديات المنتهية (Admin فقط)
router.post('/admin/end-expired', authenticateToken, challengeController.endExpiredChallenges);

export default router;
