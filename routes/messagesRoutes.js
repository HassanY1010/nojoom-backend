// routes/messagesRoutes.js
import express from 'express';
import { messagesController } from '../controllers/messagesController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

// إرسال رسالة
router.post('/send', messagesController.sendMessage);

// الحصول على محادثة مع مستخدم
router.get('/conversation/:userId', messagesController.getConversation);

// الحصول على قائمة المحادثات
router.get('/conversations', messagesController.getConversations);

// الحصول على عدد الرسائل غير المقروءة
router.get('/unread-count', messagesController.getUnreadCount);

// وضع علامة مقروء على رسائل محادثة
router.post('/mark-read/:userId', messagesController.markAsRead);

// البحث في الرسائل
router.get('/search', messagesController.searchMessages);

// حذف محادثة
router.delete('/conversation/:userId', messagesController.deleteConversation);

// الحصول على إحصائيات الرسائل
router.get('/stats', messagesController.getMessageStats);

export default router;