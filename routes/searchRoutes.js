// routes/searchRoutes.js
import express from 'express';
import * as searchController from '../controllers/searchController.js';
import * as authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// البحث الأساسي
router.get('/', authMiddleware.optional, searchController.search);

// البحث في الهاشتاجات
router.get('/hashtags', authMiddleware.optional, searchController.searchHashtags);

// الهاشتاجات الرائجة
router.get('/trending-hashtags', authMiddleware.optional, searchController.getTrendingHashtags);

// الاقتراحات التلقائية
router.get('/suggestions', authMiddleware.optional, searchController.getSuggestions);

// تسجيل تفاعل البحث
router.post('/interaction', authMiddleware.required, searchController.recordInteraction);

// تاريخ البحث
router.get('/history', authMiddleware.required, searchController.getSearchHistory);
router.delete('/history', authMiddleware.required, searchController.clearSearchHistory);

// التوصيات بناءً على البحث
router.get('/recommendations', authMiddleware.optional, searchController.getSearchRecommendations);

export default router;