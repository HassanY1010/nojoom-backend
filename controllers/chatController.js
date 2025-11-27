import { Message } from '../models/Message.js';

export const chatController = {
  async getMessages(req, res) {
    try {
      const { videoId } = req.params;
      const messages = await Message.getByVideoId(videoId);

      res.json({ messages });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async sendMessage(req, res) {
    try {
      const { videoId, content } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const messageId = await Message.create({
        sender_id: req.user.id,
        video_id: videoId,
        content: content.trim()
      });

      // Get the complete message with user info
      const [messages] = await Promise.all([
        Message.getByVideoId(videoId, 1) // Get latest message
      ]);

      const message = messages[messages.length - 1];

      res.status(201).json({
        message: 'Message sent successfully',
        newMessage: message
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteMessage(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Message.delete(id, req.user.id);

      if (!deleted) {
        return res.status(404).json({ error: 'Message not found or access denied' });
      }

      res.json({ message: 'Message deleted successfully' });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};