import express from 'express';
import exploreController from '../controllers/exploreController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/videos', exploreController.getExploreVideos);
router.get('/users', exploreController.getExploreUsers);
router.get('/search', exploreController.searchExplore);
router.get('/hashtags/trending', exploreController.getTrendingHashtags);
router.get('/stats', exploreController.getExploreStats);

// Protected route
router.post('/view', authenticateToken, exploreController.recordExploreView);

export default router;