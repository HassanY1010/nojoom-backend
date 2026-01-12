import fetch from 'node-fetch';

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

async function verifyHome() {
    console.log('🚀 Starting Home Page Verification...');

    try {
        // 1. Login
        const token = await loginUser('hassan@gmail.com', 'hhaall112233$');
        if (!token) {
            console.error('❌ Login failed');
            process.exit(1);
        }
        const headers = { 'Authorization': `Bearer ${token}` };
        console.log('✅ Logged in successfully.');

        // 2. Fetch All Videos (For You Feed)
        console.log('\n🎥 Fetching All Videos (For You)...');
        const videosRes = await fetch(`${API_URL}/videos`, { headers });
        const videosData = await videosRes.json();
        console.log(`Response Status: ${videosRes.status}`);
        if (videosData.videos) {
            console.log(`✅ Got ${videosData.videos.length} videos.`);
            if (videosData.videos.length > 0) {
                console.log('Sample Video:', {
                    id: videosData.videos[0].id,
                    description: videosData.videos[0].description,
                    views: videosData.videos[0].views,
                    likes: videosData.videos[0].likes
                });
            }
        } else {
            console.log('❌ Failed to get videos:', videosData);
        }

        // 3. Fetch Recommended Videos
        console.log('\n⭐ Fetching Recommended Videos...');
        const recommendedRes = await fetch(`${API_URL}/videos/recommended`, { headers });
        const recommendedData = await recommendedRes.json();
        console.log(`Response Status: ${recommendedRes.status}`);
        if (recommendedData.videos) {
            console.log(`✅ Got ${recommendedData.videos.length} recommended videos.`);
        } else {
            console.log('❌ Failed to get recommendations:', recommendedData);
        }

        // 4. Fetch Following Videos
        console.log('\n👥 Fetching Following Videos...');
        const followingRes = await fetch(`${API_URL}/videos/following`, { headers });
        const followingData = await followingRes.json();
        console.log(`Response Status: ${followingRes.status}`);
        if (followingData.videos !== undefined) {
            console.log(`✅ Got ${followingData.videos.length} following videos.`);
        } else {
            console.log('❌ Failed to get following videos:', followingData);
        }

        // 5. Fetch Watch History
        console.log('\n📜 Fetching Watch History...');
        const historyRes = await fetch(`${API_URL}/user/watch-history`, { headers });
        const historyData = await historyRes.json();
        console.log(`Response Status: ${historyRes.status}`);
        if (historyData.success !== false) {
            console.log(`✅ Watch history loaded successfully.`);
        } else {
            console.log('❌ Failed to get watch history:', historyData);
        }

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        process.exit();
    }
}

verifyHome();
