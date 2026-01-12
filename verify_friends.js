
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

async function verifyFriends() {
    console.log('🚀 Starting Friends Verification...');

    try {
        // 1. Login
        const token = await loginUser('hassan@gmail.com', 'hhaall112233$');
        if (!token) {
            console.error('❌ Login failed');
            process.exit(1);
        }
        const headers = { 'Authorization': `Bearer ${token}` };
        console.log('✅ Logged in successfully.');

        // 2. Fetch Followers
        console.log('\n👥 Fetching Followers...');
        const followersRes = await fetch(`${API_URL}/users/followers`, { headers });
        const followersData = await followersRes.json();
        console.log(`Response Status: ${followersRes.status}`);
        if (followersData.success) {
            console.log(`✅ Got ${followersData.followers.length} followers.`);
        } else {
            console.log('❌ Failed to get followers:', followersData);
        }

        // 3. Fetch Following
        console.log('\n👥 Fetching Following...');
        const followingRes = await fetch(`${API_URL}/users/following`, { headers });
        const followingData = await followingRes.json();
        console.log(`Response Status: ${followingRes.status}`);
        if (followingData.success) {
            console.log(`✅ Got ${followingData.following.length} following.`);
        } else {
            console.log('❌ Failed to get following:', followingData);
        }

        // 4. Fetch Suggested Users
        console.log('\n🌟 Fetching Suggested Users...');
        const suggestedRes = await fetch(`${API_URL}/users/suggested-users?limit=5`, { headers });
        const suggestedData = await suggestedRes.json();
        if (suggestedData.success) {
            console.log(`✅ Got ${suggestedData.data.length} suggested users.`);
        } else {
            console.log('❌ Failed to get suggestions:', suggestedData);
        }

        // 5. Search Users
        console.log('\n🔍 Testing User Search...');
        const searchRes = await fetch(`${API_URL}/users/search?q=a`, { headers });
        const searchData = await searchRes.json();
        if (searchData.users) {
            console.log(`✅ Search successful. Found ${searchData.users.length} users.`);
        } else {
            console.log('❌ Search failed:', searchData);
        }

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        process.exit();
    }
}

verifyFriends();
