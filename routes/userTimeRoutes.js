// server/routes/userTimeRoutes.js
import express from 'express';
import { timeLimitMiddleware } from '../middleware/timeLimiter.js';
import TimeLimiter from '../middleware/timeLimiter.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// التحقق من الحد الزمني
router.post('/check-time-limit', authenticate, timeLimitMiddleware, async (req, res) => {
  try {
    const { videoId } = req.body;
    const userId = req.user.id;

    const timeCheck = await TimeLimiter.checkTimeLimit(userId, videoId);
    
    res.json({
      success: true,
      exceeded: timeCheck.exceeded,
      remainingTime: timeCheck.remainingTime,
      totalWatchTime: timeCheck.totalWatchTime
    });
  } catch (error) {
    console.error('Check time limit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check time limit'
    });
  }
});

// إعادة تعيين وقت المشاهدة
router.post('/reset-watch-time', authenticate, async (req, res) => {
  try {
    const { videoId } = req.body;
    const userId = req.user.id;

    await TimeLimiter.resetWatchSession(userId, videoId);
    
    res.json({
      success: true,
      message: 'Watch time reset successfully'
    });
  } catch (error) {
    console.error('Reset watch time error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset watch time'
    });
  }
});

// الحصول على إحصائيات المشاهدة
router.get('/watch-stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await TimeLimiter.getUserWatchStats(userId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get watch stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get watch statistics'
    });
  }
});

// تسجيل وقت المشاهدة
router.post('/record-watch-time', authenticate, async (req, res) => {
  try {
    const { videoId, watchTime } = req.body;
    const userId = req.user.id;

    await TimeLimiter.recordWatchActivity(userId, videoId, watchTime);
    
    res.json({
      success: true,
      message: 'Watch time recorded successfully'
    });
  } catch (error) {
    console.error('Record watch time error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record watch time'
    });
  }
});

export default router;