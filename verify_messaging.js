import { Message } from './models/Message.js';
import { pool } from './config/db.js';

async function verify() {
    try {
        const sender_id = 19; // hassan
        const receiver_id = 20; // admin
        const content = "Verification message at " + new Date().toISOString();

        console.log('--- Step 1: Sending message ---');
        const messageId = await Message.createDirectMessage({ sender_id, receiver_id, content });
        console.log('✅ Message created with ID:', messageId);

        console.log('--- Step 2: Checking direct_messages table ---');
        const [msgs] = await pool.execute('SELECT * FROM direct_messages WHERE id = ?', [messageId]);
        console.log('Message stored:', JSON.stringify(msgs[0]));

        console.log('--- Step 3: Checking active_conversations table ---');
        const [user1, user2] = [sender_id, receiver_id].sort((a, b) => a - b);
        const [convs] = await pool.execute('SELECT * FROM active_conversations WHERE user1_id = ? AND user2_id = ?', [user1, user2]);
        console.log('Conversation metadata:', JSON.stringify(convs[0]));

        console.log('--- Step 4: Checking unread counts via getUserConversations ---');
        const conversations = await Message.getUserConversations(receiver_id);
        const targetConv = conversations.find(c => c.other_user_id === sender_id);
        console.log('Unread count for receiver:', targetConv?.unread_count);

        console.log('--- Step 5: Marking as read ---');
        const affectedCount = await Message.markAsRead(sender_id, receiver_id);
        console.log('✅ Marked as read. Affected rows:', affectedCount);

        console.log('--- Step 6: Checking unread count again ---');
        const conversationsAfter = await Message.getUserConversations(receiver_id);
        const targetConvAfter = conversationsAfter.find(c => c.other_user_id === sender_id);
        console.log('Unread count after marking read:', targetConvAfter?.unread_count);

        process.exit(0);
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
