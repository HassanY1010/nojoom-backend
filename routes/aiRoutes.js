// routes/aiRoutes.js
import express from 'express';
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
    recordEyeTracking,
    recordScrollBehavior,
    recordVoiceInteraction,
    getAIRecommendations,
    getAIProfile,
    updateAISettings,
    deleteAIData,
    getAIStats,
    updateUserModel,
    recordBatchInteractions
} from '../controllers/aiTrackingController.js';

const router = express.Router();

// ============ AI Tracking Endpoints ============

// تسجيل تتبع العين
router.post('/track/eye', authenticateToken, recordEyeTracking);

// تسجيل سلوك التمرير
router.post('/track/scroll', authenticateToken, recordScrollBehavior);

// تسجيل التفاعل الصوتي
router.post('/track/voice', authenticateToken, recordVoiceInteraction);

// تسجيل تفاعلات مجمعة (Batch)
router.post('/track/batch', authenticateToken, recordBatchInteractions);

// ============ AI Recommendations ============

// الحصول على توصيات مدعومة بالذكاء الاصطناعي
router.get('/recommendations', authenticateToken, getAIRecommendations);

// ============ AI Profile Management ============

// الحصول على ملف المستخدم AI
router.get('/profile', authenticateToken, getAIProfile);

// تحديث إعدادات AI
router.put('/settings', authenticateToken, updateAISettings);

// حذف بيانات AI
router.delete('/data', authenticateToken, deleteAIData);

// الحصول على إحصائيات AI
router.get('/stats', authenticateToken, getAIStats);

// تحديث نموذج المستخدم
router.post('/update-model', authenticateToken, updateUserModel);

export default router;
