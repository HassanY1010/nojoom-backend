import express from 'express';
import { chatController } from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:videoId', chatController.getMessages);
router.post('/send', authenticateToken, chatController.sendMessage);
router.delete('/:id', authenticateToken, chatController.deleteMessage);

export default router;