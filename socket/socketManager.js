import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { pool } from '../config/db.js';
import { Comment } from '../models/Comment.js';
import { Message } from '../models/Message.js';

// الثوابت
const MAX_WATCH_TIME = 2 * 60 * 60 * 1000; // ساعتين بالمللي ثانية
const MAX_DISPLAY_COUNT = 4; // أقصى عدد مرات عرض الرسالة
const MESSAGE_TTL = 5 * 60 * 1000; // 5 دقائق لحذف الرسائل تلقائيًا

// ✅ تخزين مؤقت للرسائل مع نظام التدوير
const messageStore = new Map();
const connectedUsers = new Map();
let io;

export const initSocket = (server) => {
  if (io) {
    console.log('⚠️ Socket.IO already initialized, skipping...');
    return io;
  }

  try {
    io = new Server(server, {
      cors: {
        origin: function (origin, callback) {
          if (!origin) return callback(null, true);
          const isAllowed = [process.env.CLIENT_URL].includes(origin) ||
            origin.endsWith('.vercel.app') ||
            origin.includes('localhost');
          if (isAllowed) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    console.log('✅ Socket.IO initialized successfully');

    // ==================== مصادقة Socket ====================
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          console.log('❌ No token provided for socket connection');
          return next(new Error('Authentication error'));
        }

        jwt.verify(token, jwtConfig.secret, async (err, decoded) => {
          if (err) {
            console.log('❌ Socket token verification failed:', err.message);
            return next(new Error('Authentication error'));
          }

          try {
            const [users] = await pool.execute(
              'SELECT id, username, email, avatar, role, is_banned FROM users WHERE id = ?',
              [decoded.id]
            );

            if (users.length === 0) {
              return next(new Error('User not found'));
            }

            if (users[0].is_banned) {
              return next(new Error('User is banned'));
            }

            socket.userId = decoded.id;
            socket.user = users[0];
            socket.username = users[0].username;
            console.log('✅ Socket authenticated for user:', socket.username);
            next();
          } catch (dbError) {
            console.error('Database error in socket auth:', dbError);
            next(new Error('Authentication error'));
          }
        });
      } catch (error) {
        console.error('Socket auth error:', error);
        next(new Error('Authentication error'));
      }
    });

    // ==================== إدارة المستخدمين المتصلين ====================
    io.on("connection", (socket) => {
      console.log("✅ User connected:", socket.id, "User:", socket.username);

      // ✅ إضافة المستخدم إلى قائمة المتصلين
      connectedUsers.set(socket.userId, {
        id: socket.userId,
        username: socket.username,
        socketId: socket.id,
        role: socket.user.role,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      // ✅ تحديث إحصائيات المستخدمين النشطين
      updateActiveUsersCount(io);

      // ==================== نظام الغرف المحسّن ====================

      // الانضمام إلى غرفة المستخدم للرسائل المباشرة
      socket.join(`user_${socket.userId}`);
      socket.join(`user:${socket.userId}`);
      console.log(`👤 User ${socket.username} joined user rooms: user_${socket.userId} and user:${socket.userId}`);

      // Join user to their own room (النظام القديم)
      socket.on('join-user', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined room: user_${userId}`);
      });

      // Join video room (النظام القديم)
      socket.on('join-video', (videoId) => {
        socket.join(`video_${videoId}`);
        console.log(`🎥 User ${socket.id} joined video room: video_${videoId}`);
      });

      // Handle video like (النظام القديم)
      socket.on('video-like', (data) => {
        const { videoId, userId } = data;
        socket.to(`video_${videoId}`).emit('video-liked', data);
        console.log(`❤️ User ${userId} liked video ${videoId}`);
      });

      // Handle new comment (النظام القديم)
      socket.on('new-comment', (data) => {
        const { videoId, comment } = data;
        socket.to(`video_${videoId}`).emit('comment-added', data);
        console.log(`💬 New comment on video ${videoId}`);
      });

      // Handle real-time messages (النظام القديم)
      socket.on('send-message', (data) => {
        const { receiverId, message } = data;
        socket.to(`user_${receiverId}`).emit('new-message', data);
        console.log(`📨 Message sent to user ${receiverId}`);
      });

      // ==================== إدارة غرف الفيديو المحسّنة ====================
      socket.on("join_video", (videoId) => {
        const roomName = `video:${videoId}`;
        const oldRoomName = `video_${videoId}`;

        socket.join(roomName);
        socket.join(oldRoomName); // للحفاظ على التوافق
        console.log(`👥 User ${socket.username} joined ${roomName}`);

        // ✅ تحديث آخر نشاط
        updateUserActivity(socket.userId);

        // إرسال تأكيد الانضمام
        socket.emit('joined_room', { videoId, roomName });

        // إرسال عدد المشاهدين الحالي للغرفة
        const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
        io.to(roomName).emit('viewers_count_updated', {
          videoId,
          count: roomSize
        });

        // إرسال الرسائل المخزنة مؤقتًا لهذا الفيديو
        sendStoredMessages(socket, videoId);
      });

      socket.on("leave_video", (videoId) => {
        const roomName = `video:${videoId}`;
        const oldRoomName = `video_${videoId}`;

        socket.leave(roomName);
        socket.leave(oldRoomName);
        console.log(`👋 User ${socket.username} left ${roomName}`);

        // ✅ تحديث آخر نشاط
        updateUserActivity(socket.userId);

        // تحديث عدد المشاهدين
        const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
        io.to(roomName).emit('viewers_count_updated', {
          videoId,
          count: roomSize
        });
      });

      // ==================== نظام الدردشة المحسّن ====================
      socket.on("chat_message", async (data) => {
        try {
          const { videoId, content } = data;

          if (!content || content.trim() === '') {
            socket.emit('error', { message: 'Message cannot be empty' });
            return;
          }

          // التحقق من الطول
          if (content.length > 200) {
            socket.emit('error', { message: 'Message too long (max 200 characters)' });
            return;
          }

          console.log(`💬 Chat message from ${socket.username} in video ${videoId}:`, content);

          // ✅ تحديث آخر نشاط
          updateUserActivity(socket.userId);

          // إنشاء رسالة جديدة مع نظام التدوير
          const messageId = Date.now() + Math.random(); // ID مؤقت
          const message = {
            id: messageId,
            sender_id: socket.userId,
            video_id: videoId,
            content: content.trim(),
            type: 'user',
            created_at: new Date().toISOString(),
            username: socket.username,
            avatar: socket.user.avatar,
            display_count: 1,
            timestamp: Date.now()
          };

          // حفظ الرسالة في التخزين المؤقت
          saveMessageToStore(message);

          // إرسال الرسالة لجميع المستخدمين في الغرفة (كلا النظامين)
          io.to(`video:${videoId}`).emit("chat_message", message);
          io.to(`video_${videoId}`).emit("chat_message", message);
          console.log(`📤 Message broadcast to video:${videoId} and video_${videoId}`);

          // تحديث إحصائيات الرسائل
          updateMessageStats(io);

        } catch (error) {
          console.error('❌ Chat message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // ==================== البث الإداري المحسّن ====================
      socket.on("broadcast_admin", async (data) => {
        try {
          if (socket.user.role !== 'admin') {
            socket.emit('error', { message: 'Admin access required' });
            return;
          }

          const { content } = data;

          if (!content || content.trim() === '') {
            socket.emit('error', { message: 'Broadcast content cannot be empty' });
            return;
          }

          console.log(`📢 Admin broadcast from ${socket.username}:`, content);

          // ✅ تحديث آخر نشاط
          updateUserActivity(socket.userId);

          // إنشاء رسالة بث مع نظام التدوير
          const messageId = Date.now() + Math.random();
          const broadcastMessage = {
            id: messageId,
            content: content.trim(),
            type: 'admin',
            created_at: new Date().toISOString(),
            username: socket.username || 'Admin',
            display_count: 1,
            timestamp: Date.now()
          };

          // حفظ البث في التخزين المؤقت
          saveMessageToStore(broadcastMessage);

          // إرسال البث لجميع المستخدمين المتصلين
          io.emit("broadcast_message", broadcastMessage);

          // إرسال البث لجميع غرف الفيديو النشطة (كلا النظامين)
          const rooms = io.sockets.adapter.rooms;
          for (const [roomName, room] of rooms) {
            if (roomName.startsWith('video:') || roomName.startsWith('video_')) {
              io.to(roomName).emit("broadcast_message", broadcastMessage);
            }
          }

          console.log('📢 Broadcast sent to all users and video rooms');

          // حفظ البث في قاعدة البيانات
          await pool.execute(
            'INSERT INTO broadcasts (admin_id, content, created_at) VALUES (?, ?, NOW())',
            [socket.userId, content.trim()]
          );

          // إرسال تأكيد للمرسل
          socket.emit('broadcast_sent', {
            success: true,
            message: 'Broadcast sent successfully to all users',
            broadcastId: messageId
          });

        } catch (error) {
          console.error('❌ Broadcast error:', error);
          socket.emit('error', { message: 'Failed to send broadcast' });
        }
      });

      // ==================== مؤشرات الكتابة المحسنة ====================
      socket.on("typing_start", (data) => {
        const { videoId } = data;
        socket.to(`video:${videoId}`).emit("user_typing", {
          username: socket.username,
          userId: socket.userId,
          avatar: socket.user.avatar
        });
      });

      socket.on("typing_stop", (data) => {
        const { videoId } = data;
        socket.to(`video:${videoId}`).emit("user_stopped_typing", {
          userId: socket.userId
        });
      });

      // ==================== ✅ نظام التعليقات المحسن ====================
      socket.on("new_comment", async (data) => {
        try {
          const { videoId, comment } = data;

          console.log(`💬 New comment via socket from ${socket.username} on video ${videoId}`);

          // ✅ تحديث آخر نشاط
          updateUserActivity(socket.userId);

          // بث التعليق الجديد لجميع المستخدمين في غرفة الفيديو (كلا النظامين)
          io.to(`video:${videoId}`).emit("new_comment", {
            ...comment,
            username: socket.username,
            avatar: socket.user.avatar,
            is_owner: false
          });

          io.to(`video_${videoId}`).emit("comment-added", {
            videoId,
            comment: {
              ...comment,
              username: socket.username,
              avatar: socket.user.avatar
            }
          });

          console.log(`📤 Comment broadcast to video:${videoId} and video_${videoId}`);

        } catch (error) {
          console.error('❌ New comment socket error:', error);
          socket.emit('error', { message: 'Failed to send comment' });
        }
      });

      socket.on("delete_comment", async (data) => {
        try {
          const { commentId, videoId } = data;

          // التحقق من أن المستخدم هو صاحب التعليق
          const comment = await Comment.findById(commentId);
          if (!comment || comment.user_id !== socket.userId) {
            socket.emit('error', { message: 'Not authorized to delete this comment' });
            return;
          }

          const deleted = await Comment.delete(commentId, socket.userId);

          if (deleted) {
            // بث حذف التعليق لجميع المستخدمين في الغرفة (كلا النظامين)
            io.to(`video:${videoId}`).emit("comment_deleted", {
              commentId,
              videoId,
              deletedBy: socket.userId
            });

            io.to(`video_${videoId}`).emit("comment_deleted", {
              commentId,
              videoId,
              deletedBy: socket.userId
            });

            console.log(`🗑️ Comment ${commentId} deleted by ${socket.username}`);
          }

        } catch (error) {
          console.error('❌ Delete comment socket error:', error);
          socket.emit('error', { message: 'Failed to delete comment' });
        }
      });

      socket.on("typing_comment", (data) => {
        const { videoId, isTyping } = data;

        socket.to(`video:${videoId}`).emit("user_typing_comment", {
          userId: socket.userId,
          username: socket.username,
          avatar: socket.user.avatar,
          isTyping
        });
      });

      // ==================== طلبات خاصة بالدردشة ====================
      socket.on("get_chat_messages", (data, callback) => {
        try {
          const { videoId } = data;
          const messages = Array.from(messageStore.values())
            .filter(msg => msg.video_id === videoId || msg.type === 'admin')
            .slice(-50);

          if (callback) {
            callback({ success: true, messages });
          }
        } catch (error) {
          console.error('Get chat messages error:', error);
          if (callback) {
            callback({ success: false, error: 'Failed to get messages' });
          }
        }
      });

      socket.on("message_displayed", (data) => {
        try {
          const { messageId } = data;
          updateMessageDisplayCount(messageId);
        } catch (error) {
          console.error('Message displayed update error:', error);
        }
      });

      // ==================== تتبع وقت المشاهدة المحسن ====================
      socket.on("video_watch_time", async (data) => {
        try {
          const { videoId, watchTime, completed = false } = data;

          // التحقق من صحة البيانات
          if (watchTime <= 0 || watchTime > 3600000) {
            console.log('⚠️ Invalid watch time:', watchTime);
            return;
          }

          // ✅ تحديث آخر نشاط
          updateUserActivity(socket.userId);

          // ✅ التصحيح: استخدام ON DUPLICATE KEY UPDATE بدلاً من INSERT مباشرة
          await pool.execute(
            `INSERT INTO watch_history (user_id, video_id, watch_time, completed) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             watch_time = watch_time + VALUES(watch_time), 
             completed = VALUES(completed),
             updated_at = CURRENT_TIMESTAMP`,
            [socket.userId, videoId, watchTime, completed]
          );

          // تحديث إجمالي وقت المشاهدة للمستخدم
          await pool.execute(
            'UPDATE users SET total_watch_time = total_watch_time + ? WHERE id = ?',
            [watchTime, socket.userId]
          );

          // تحديث مشاهدات الفيديو
          await pool.execute(
            'UPDATE videos SET views = views + 1 WHERE id = ?',
            [videoId]
          );

          console.log(`⏱️ Watch time updated for user ${socket.username}: ${watchTime}ms for video ${videoId}`);

          // إرسال تحديث للمستخدم
          socket.emit('watch_time_updated', {
            videoId,
            watchTime,
            totalWatchTime: await getUserTotalWatchTime(socket.userId)
          });

        } catch (error) {
          console.error('❌ Watch time tracking error:', error);
        }
      });

      // ==================== ✅ حدث جديد لتحديث سجل المشاهدة ====================
      socket.on("update_watch_history", async (data) => {
        try {
          const { videoId, watchTime = 1, completed = false } = data;
          const userId = socket.userId;

          console.log('🔄 Updating watch history via socket:', { userId, videoId, watchTime });

          // ✅ التصحيح: استخدام ON DUPLICATE KEY UPDATE
          await pool.execute(
            `INSERT INTO watch_history (user_id, video_id, watch_time, completed) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             watch_time = watch_time + VALUES(watch_time), 
             completed = VALUES(completed),
             updated_at = CURRENT_TIMESTAMP`,
            [userId, videoId, watchTime, completed]
          );

          console.log(`✅ Watch history updated via socket for user ${userId}, video ${videoId}`);

        } catch (error) {
          console.error('❌ Update watch history via socket error:', error);
        }
      });

      // ==================== التحقق من الحد الزمني ====================
      socket.on("check_time_limit", async (data, callback) => {
        try {
          const { videoId } = data;

          const timeCheck = await checkTimeLimit(socket.userId, videoId);

          if (callback) {
            callback(timeCheck);
          }

          if (timeCheck.exceeded) {
            socket.emit('time_limit_exceeded', {
              videoId,
              message: 'You have reached the maximum watch time for today',
              limit: MAX_WATCH_TIME,
              used: timeCheck.usedTime
            });
          }

        } catch (error) {
          console.error('❌ Time limit check error:', error);
          if (callback) {
            callback({ exceeded: false, remainingTime: MAX_WATCH_TIME, usedTime: 0 });
          }
        }
      });

      // ==================== الإعجابات المحسنة ====================
      socket.on("video_like", async (data) => {
        try {
          const { videoId } = data;

          // ✅ تحديث آخر نشاط
          updateUserActivity(socket.userId);

          const [existingLikes] = await pool.execute(
            'SELECT id FROM likes WHERE user_id = ? AND video_id = ?',
            [socket.userId, videoId]
          );

          if (existingLikes.length > 0) {
            // إلغاء الإعجاب
            await pool.execute(
              'DELETE FROM likes WHERE user_id = ? AND video_id = ?',
              [socket.userId, videoId]
            );
            await pool.execute(
              'UPDATE videos SET likes = GREATEST(likes - 1, 0) WHERE id = ?',
              [videoId]
            );
          } else {
            // إضافة إعجاب
            await pool.execute(
              'INSERT INTO likes (user_id, video_id) VALUES (?, ?)',
              [socket.userId, videoId]
            );
            await pool.execute(
              'UPDATE videos SET likes = likes + 1 WHERE id = ?',
              [videoId]
            );
          }

          const [videos] = await pool.execute(
            'SELECT likes FROM videos WHERE id = ?',
            [videoId]
          );

          const isLiked = existingLikes.length === 0;

          // بث تحديث الإعجابات لجميع المشاهدين (كلا النظامين)
          io.to(`video:${videoId}`).emit("video_likes_updated", {
            videoId,
            likes: videos[0].likes,
            userLiked: isLiked,
            userId: socket.userId
          });

          io.to(`video_${videoId}`).emit("video-liked", {
            videoId,
            userId: socket.userId,
            likes: videos[0].likes,
            userLiked: isLiked
          });

          console.log(`❤️ Like updated for video ${videoId} by ${socket.username} (${isLiked ? 'liked' : 'unliked'})`);

        } catch (error) {
          console.error('❌ Video like error:', error);
          socket.emit('error', { message: 'Failed to update like' });
        }
      });

      // ==================== المتابعة المحسنة ====================
      socket.on("user_follow", async (data) => {
        try {
          const { targetUserId } = data;

          if (socket.userId === parseInt(targetUserId)) {
            socket.emit('error', { message: 'Cannot follow yourself' });
            return;
          }

          // ✅ تحديث آخر نشاط
          updateUserActivity(socket.userId);

          const [existingFollow] = await pool.execute(
            'SELECT id FROM followers WHERE follower_id = ? AND following_id = ?',
            [socket.userId, targetUserId]
          );

          if (existingFollow.length > 0) {
            // إلغاء المتابعة
            await pool.execute(
              'DELETE FROM followers WHERE follower_id = ? AND following_id = ?',
              [socket.userId, targetUserId]
            );
            await pool.execute(
              'UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = ?',
              [targetUserId]
            );
            await pool.execute(
              'UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = ?',
              [socket.userId]
            );

            socket.to(`user:${targetUserId}`).emit("user_unfollowed", {
              followerId: socket.userId,
              followerUsername: socket.username
            });

          } else {
            // متابعة
            await pool.execute(
              'INSERT INTO followers (follower_id, following_id) VALUES (?, ?)',
              [socket.userId, targetUserId]
            );
            await pool.execute(
              'UPDATE users SET followers_count = followers_count + 1 WHERE id = ?',
              [targetUserId]
            );
            await pool.execute(
              'UPDATE users SET following_count = following_count + 1 WHERE id = ?',
              [socket.userId]
            );

            socket.to(`user:${targetUserId}`).emit("user_followed", {
              followerId: socket.userId,
              followerUsername: socket.username
            });
          }

          const [targetUser] = await pool.execute(
            'SELECT followers_count FROM users WHERE id = ?',
            [targetUserId]
          );
          const [currentUser] = await pool.execute(
            'SELECT following_count FROM users WHERE id = ?',
            [socket.userId]
          );

          const isFollowing = existingFollow.length === 0;

          socket.emit("follow_status_updated", {
            targetUserId,
            isFollowing: isFollowing,
            targetFollowers: targetUser[0].followers_count,
            currentFollowing: currentUser[0].following_count
          });

          console.log(`👥 Follow status updated for user ${targetUserId} by ${socket.username} (${isFollowing ? 'following' : 'unfollowed'})`);

        } catch (error) {
          console.error('❌ User follow error:', error);
          socket.emit('error', { message: 'Failed to update follow status' });
        }
      });

      // ==================== حالة الاتصال المحسنة ====================
      socket.on("user_online", () => {
        console.log(`🟢 User ${socket.username} is online`);

        updateUserActivity(socket.userId);

        pool.execute(
          'UPDATE users SET last_seen = NOW(), is_online = TRUE WHERE id = ?',
          [socket.userId]
        ).catch(console.error);

        socket.broadcast.emit("user_online_status", {
          userId: socket.userId,
          username: socket.username,
          avatar: socket.user.avatar,
          isOnline: true,
          timestamp: new Date().toISOString()
        });
      });

      socket.on("user_away", () => {
        console.log(`🟡 User ${socket.username} is away`);

        pool.execute(
          'UPDATE users SET is_online = FALSE WHERE id = ?',
          [socket.userId]
        ).catch(console.error);

        socket.broadcast.emit("user_online_status", {
          userId: socket.userId,
          username: socket.username,
          isOnline: false,
          timestamp: new Date().toISOString()
        });
      });

      // ==================== 💬 نظام الرسائل الخاصة المحسن ====================

      socket.on("private_message", async (data) => {
        try {
          const { receiver_id, content } = data;
          const sender_id = socket.userId;

          if (!content || content.trim() === '') {
            socket.emit('error', { message: 'Message content cannot be empty' });
            return;
          }

          if (content.length > 1000) {
            socket.emit('error', { message: 'Message too long (max 1000 characters)' });
            return;
          }

          if (sender_id === parseInt(receiver_id)) {
            socket.emit('error', { message: 'Cannot send message to yourself' });
            return;
          }

          console.log(`💬 Private message from ${socket.username} to user ${receiver_id}`);

          // ✅ تحديث آخر نشاط
          updateUserActivity(socket.userId);

          // حفظ الرسالة في قاعدة البيانات
          const [result] = await pool.execute(
            'INSERT INTO direct_messages (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, NOW())',
            [sender_id, receiver_id, content.trim()]
          );

          const messageId = result.insertId;

          // الحصول على بيانات الرسالة الكاملة
          const [messages] = await pool.execute(
            `SELECT dm.*, 
                    u1.username as sender_username, u1.avatar as sender_avatar,
                    u2.username as receiver_username, u2.avatar as receiver_avatar
             FROM direct_messages dm
             JOIN users u1 ON dm.sender_id = u1.id
             JOIN users u2 ON dm.receiver_id = u2.id
             WHERE dm.id = ?`,
            [messageId]
          );

          const message = messages[0];

          // ✅ تحديث المحادثة النشطة
          await Message.updateActiveConversation(sender_id, receiver_id, messageId, content.trim());

          // إرسال الرسالة للمستقبل (كلا النظامين)
          io.to(`user:${receiver_id}`).emit("private_message_received", {
            ...message,
            id: messageId
          });

          io.to(`user_${receiver_id}`).emit("new-message", {
            receiverId: receiver_id,
            message: {
              ...message,
              id: messageId
            }
          });

          // إرسال تأكيد للمرسل
          socket.emit("private_message_sent", {
            ...message,
            id: messageId,
            status: 'sent'
          });

          console.log(`✅ Private message ${messageId} sent from ${socket.username} to user ${receiver_id}`);

        } catch (error) {
          console.error('❌ Private message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // مؤشر الكتابة للرسائل الخاصة
      socket.on("typing_private", (data) => {
        try {
          const { receiver_id, isTyping } = data;

          socket.to(`user:${receiver_id}`).emit("user_typing_private", {
            sender_id: socket.userId,
            username: socket.username,
            avatar: socket.user.avatar,
            isTyping
          });

          console.log(`⌨️ User ${socket.username} ${isTyping ? 'started' : 'stopped'} typing to user ${receiver_id}`);
        } catch (error) {
          console.error('❌ Typing indicator error:', error);
        }
      });

      // وضع علامة مقروء على الرسائل
      socket.on("mark_messages_read", async (data) => {
        try {
          const { sender_id } = data;
          const receiver_id = socket.userId;

          await pool.execute(
            'UPDATE direct_messages SET is_read = TRUE WHERE receiver_id = ? AND sender_id = ? AND is_read = FALSE',
            [receiver_id, sender_id]
          );

          // إخطار المرسل أن رسائله تم قراءتها
          io.to(`user:${sender_id}`).emit("messages_read", {
            reader_id: receiver_id,
            reader_username: socket.username
          });

          console.log(`✅ Messages from user ${sender_id} marked as read by ${socket.username}`);

        } catch (error) {
          console.error('❌ Mark messages read error:', error);
        }
      });

      // الحصول على قائمة المحادثات
      socket.on("get_conversations", async (callback) => {
        try {
          const userId = socket.userId;
          const conversations = await Message.getUserConversations(userId);

          if (callback) {
            callback({ success: true, conversations });
          }

          console.log(`📋 Sent ${conversations.length} conversations to ${socket.username}`);

        } catch (error) {
          console.error('❌ Get conversations error:', error);
          if (callback) {
            callback({ success: false, error: 'Failed to get conversations' });
          }
        }
      });

      // الحصول على محادثة مع مستخدم معين
      socket.on("get_conversation", async (data, callback) => {
        try {
          const { userId: otherUserId } = data;
          const currentUserId = socket.userId;

          const messages = await Message.getConversation(currentUserId, otherUserId);

          // تحديث الرسائل كمقروءة
          await Message.markAsRead(otherUserId, currentUserId);

          if (callback) {
            callback({ success: true, messages });
          }

          console.log(`💬 Sent conversation with user ${otherUserId} to ${socket.username} (${messages.length} messages)`);

        } catch (error) {
          console.error('❌ Get conversation error:', error);
          if (callback) {
            callback({ success: false, error: 'Failed to get conversation' });
          }
        }
      });

      // الحصول على عدد الرسائل غير المقروءة
      socket.on("get_unread_count", async (callback) => {
        try {
          const unread_count = await Message.getUnreadCount(socket.userId);

          if (callback) {
            callback({ success: true, unread_count });
          }

        } catch (error) {
          console.error('❌ Get unread count error:', error);
          if (callback) {
            callback({ success: false, error: 'Failed to get unread count' });
          }
        }
      });

      // ==================== أحداث أخرى ====================
      socket.on("get_admin_stats", async () => {
        if (socket.user.role !== 'admin') {
          socket.emit('error', { message: 'Admin access required' });
          return;
        }

        try {
          const stats = await getAdminStats();
          socket.emit('admin_stats', stats);
        } catch (error) {
          console.error('❌ Admin stats error:', error);
          socket.emit('error', { message: 'Failed to get admin stats' });
        }
      });

      // تنظيف التخزين المؤقت بانتظام
      const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, message] of messageStore.entries()) {
          if (now - message.timestamp > MESSAGE_TTL) {
            messageStore.delete(key);
          }
        }
      }, 60000); // كل دقيقة

      // ==================== قطع الاتصال ====================
      socket.on("disconnect", (reason) => {
        console.log("❌ User disconnected:", socket.id, "User:", socket.username, "Reason:", reason);

        // إيقاف تنظيف التخزين المؤقت
        clearInterval(cleanupInterval);

        // ✅ حذف المستخدم من القائمة
        connectedUsers.delete(socket.userId);
        updateActiveUsersCount(io);

        pool.execute(
          'UPDATE users SET last_seen = NOW(), is_online = FALSE WHERE id = ?',
          [socket.userId]
        ).catch(console.error);

        socket.broadcast.emit("user_online_status", {
          userId: socket.userId,
          username: socket.username,
          isOnline: false,
          timestamp: new Date().toISOString()
        });
      });

      // Handle disconnect (النظام القديم)
      socket.on('disconnect', () => {
        console.log('🔌 User disconnected:', socket.id);
      });
    });

    // ==================== معالجة الأخطاء العالمية ====================
    io.engine.on("connection_error", (err) => {
      console.error("❌ Socket.io connection error:", err);
    });

    console.log("✅ Socket.io server initialized successfully with enhanced features");
    return io;

  } catch (error) {
    console.error('❌ Socket.IO initialization error:', error);
    throw error;
  }
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// ==================== الدوال المساعدة ====================

function updateUserActivity(userId) {
  const user = connectedUsers.get(userId);
  if (user) {
    user.lastActivity = new Date();
    connectedUsers.set(userId, user);
    console.log(`🔄 Activity updated for user ${userId}`);
  }
}

function updateActiveUsersCount(io) {
  const activeUsersCount = connectedUsers.size;

  io.emit('active_users_update', {
    count: activeUsersCount,
    timestamp: new Date().toISOString()
  });

  const adminRooms = getAdminRooms();
  io.to(adminRooms).emit('admin_stats_update', {
    activeUsers: activeUsersCount,
    timestamp: new Date().toISOString()
  });

  console.log(`👥 Active users count updated: ${activeUsersCount}`);
}

function getAdminRooms() {
  const adminRooms = [];
  for (const [userId, user] of connectedUsers) {
    if (user.role === 'admin') {
      adminRooms.push(`user:${userId}`);
    }
  }
  return adminRooms;
}

function saveMessageToStore(message) {
  const messageKey = `msg_${message.id}`;
  messageStore.set(messageKey, message);

  // جدولة حذف الرسالة بعد انتهاء الوقت
  setTimeout(() => {
    messageStore.delete(messageKey);
  }, MESSAGE_TTL);
}

function sendStoredMessages(socket, videoId) {
  const messages = Array.from(messageStore.values())
    .filter(msg => msg.video_id === videoId || msg.type === 'admin')
    .slice(-50); // آخر 50 رسالة

  messages.forEach(message => {
    socket.emit("chat_message", message);
  });
}

function updateMessageDisplayCount(messageId) {
  const messageKey = `msg_${messageId}`;
  const message = messageStore.get(messageKey);
  if (message) {
    message.display_count = (message.display_count || 0) + 1;
    messageStore.set(messageKey, message);

    // إذا وصلت للحد الأقصى، حذفها
    if (message.display_count >= MAX_DISPLAY_COUNT) {
      messageStore.delete(messageKey);
    }
  }
}

async function getUserTotalWatchTime(userId) {
  try {
    const [rows] = await pool.execute(
      'SELECT total_watch_time FROM users WHERE id = ?',
      [userId]
    );
    return rows[0]?.total_watch_time || 0;
  } catch (error) {
    console.error('Error getting user watch time:', error);
    return 0;
  }
}

async function checkTimeLimit(userId, videoId) {
  try {
    const [rows] = await pool.execute(
      `SELECT COALESCE(SUM(watch_time), 0) as total_today 
       FROM watch_history 
       WHERE user_id = ? AND session_date = CURDATE()`,
      [userId]
    );

    const usedTime = rows[0].total_today;
    const exceeded = usedTime >= MAX_WATCH_TIME;
    const remainingTime = Math.max(0, MAX_WATCH_TIME - usedTime);

    return {
      exceeded,
      usedTime,
      remainingTime,
      limit: MAX_WATCH_TIME
    };
  } catch (error) {
    console.error('Error checking time limit:', error);
    return { exceeded: false, usedTime: 0, remainingTime: MAX_WATCH_TIME, limit: MAX_WATCH_TIME };
  }
}

async function getAdminStats() {
  try {
    const [
      [usersCount],
      [videosCount],
      [messagesCount],
      [storageResult],
      [dailyUploads],
      [onlineUsers],
      [serverStats]
    ] = await Promise.all([
      pool.execute('SELECT COUNT(*) as count FROM users'),
      pool.execute('SELECT COUNT(*) as count FROM videos WHERE deleted_by_admin = FALSE'),
      pool.execute('SELECT COUNT(*) as count FROM messages'),
      pool.execute('SELECT SUM(file_size) as total_size FROM videos'),
      pool.execute('SELECT COUNT(*) as count FROM videos WHERE DATE(created_at) = CURDATE()'),
      pool.execute('SELECT COUNT(*) as count FROM users WHERE is_online = TRUE'),
      pool.execute('SELECT 1 as server_load, 50 as response_time')
    ]);

    return {
      totalUsers: usersCount[0].count,
      totalVideos: videosCount[0].count,
      totalMessages: messagesCount[0].count,
      storageUsed: storageResult[0].total_size || 0,
      dailyUploads: dailyUploads[0].count,
      onlineUsers: onlineUsers[0].count,
      serverLoad: serverStats[0].server_load,
      responseTime: serverStats[0].response_time,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting admin stats:', error);
    throw error;
  }
}

async function updateMessageStats(io) {
  try {
    const [messagesCount] = await pool.execute('SELECT COUNT(*) as count FROM messages');

    io.emit('admin_stats_update', {
      totalMessages: messagesCount[0].count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating message stats:', error);
  }
}
