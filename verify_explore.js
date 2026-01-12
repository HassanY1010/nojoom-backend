
import fetch from 'node-fetch';
import { pool } from './config/db.js';

const API_URL = 'http://127.0.0.1:3333/api';

async function loginUser(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    return data.accessToken;
}

async function verifyExplore() {
    console.log('🚀 Starting Explore Verification...');

    try {
        // 1. Login
        const token = await loginUser('hassan@example.com', 'password123'); // Assuming hassan exists
        const headers = { 'Authorization': `Bearer ${token}` };
        console.log('✅ Logged in successfully.');

        // 2. Fetch Explore Videos
        console.log('\n🎥 Fetching Explore Videos...');
        const videosRes = await fetch(`${API_URL}/explore/videos?limit=5`, { headers });
        const videosData = await videosRes.json();
        console.log(`Response Status: ${videosRes.status}`);
        if (videosData.videos) {
            console.log(`✅ Got ${videosData.videos.length} videos.`);
            if (videosData.videos.length > 0) {
                console.log('Sample Video:', {
                    id: videosData.videos[0].id,
                    views: videosData.videos[0].views,
                    likes: videosData.videos[0].likes,
                    user: videosData.videos[0].username
                });
            }
        } else {
            console.log('❌ Failed to get videos:', videosData);
        }

        // 3. Fetch Explore Users
        console.log('\n👥 Fetching Explore Users...');
        const usersRes = await fetch(`${API_URL}/explore/users?limit=5`, { headers });
        const usersData = await usersRes.json();
        console.log(`Response Status: ${usersRes.status}`);
        if (usersData.users) {
            console.log(`✅ Got ${usersData.users.length} users.`);
            if (usersData.users.length > 0) {
                console.log('Sample User:', {
                    id: usersData.users[0].id,
                    username: usersData.users[0].username,
                    followers: usersData.users[0].followers_count,
                    following: usersData.users[0].following_count
                });
            }
        } else {
            console.log('❌ Failed to get users:', usersData);
        }

        // 4. Test Search
        console.log('\n🔍 Testing Search...');
        const searchRes = await fetch(`${API_URL}/explore/search?q=test`, { headers });
        const searchData = await searchRes.json();
        if (searchData.videos || searchData.users) {
            console.log(`✅ Search successful. Found ${searchData.videos?.length || 0} videos, ${searchData.users?.length || 0} users.`);
        } else {
            console.log('❌ Search failed:', searchData);
        }

        // 5. Test Stats
        console.log('\n📊 Testing Stats...');
        const statsRes = await fetch(`${API_URL}/explore/stats`, { headers });
        const statsData = await statsRes.json();
        console.log('Stats:', statsData);

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        process.exit();
    }
}

verifyExplore();
