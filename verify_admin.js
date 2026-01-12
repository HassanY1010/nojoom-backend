import fetch from 'node-fetch';

const API_URL = 'http://127.0.0.1:3333/api';

async function loginAdmin(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    return { token: data.accessToken, role: data.user?.role };
}

async function verifyAdmin() {
    console.log('🚀 Starting Admin Dashboard Verification...');

    try {
        // 1. Login as Admin
        console.log('\n🔐 Logging in as admin...');
        const { token, role } = await loginAdmin('admin@admin.com', 'hhaall112233$');
        if (!token) {
            console.error('❌ Admin login failed');
            process.exit(1);
        }
        console.log(`✅ Logged in successfully. Role: ${role}`);

        if (role !== 'admin') {
            console.error('❌ User is not an admin!');
            process.exit(1);
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        // 2. Fetch Admin Stats
        console.log('\n📊 Fetching Admin Stats...');
        const statsRes = await fetch(`${API_URL}/admin/stats`, { headers });
        const statsData = await statsRes.json();
        console.log(`Response Status: ${statsRes.status}`);
        if (statsData.stats) {
            console.log('✅ Got admin stats:', {
                totalUsers: statsData.stats.totalUsers,
                totalVideos: statsData.stats.totalVideos,
                pendingReports: statsData.stats.pendingReports,
                activeUsers: statsData.stats.activeUsers
            });
        } else {
            console.log('❌ Failed to get stats:', statsData);
        }

        // 3. Fetch Users
        console.log('\n👥 Fetching Users...');
        const usersRes = await fetch(`${API_URL}/admin/users`, { headers });
        const usersData = await usersRes.json();
        console.log(`Response Status: ${usersRes.status}`);
        if (usersData.users) {
            console.log(`✅ Got ${usersData.users.length} users.`);
        } else {
            console.log('❌ Failed to get users:', usersData);
        }

        // 4. Fetch Videos
        console.log('\n🎥 Fetching Videos...');
        const videosRes = await fetch(`${API_URL}/admin/videos`, { headers });
        const videosData = await videosRes.json();
        console.log(`Response Status: ${videosRes.status}`);
        if (videosData.videos) {
            console.log(`✅ Got ${videosData.videos.length} videos.`);
        } else {
            console.log('❌ Failed to get videos:', videosData);
        }

        // 5. Fetch Reports
        console.log('\n🚩 Fetching Reports...');
        const reportsRes = await fetch(`${API_URL}/admin/reports`, { headers });
        const reportsData = await reportsRes.json();
        console.log(`Response Status: ${reportsRes.status}`);
        if (reportsData.reports !== undefined) {
            console.log(`✅ Got ${reportsData.reports.length} reports.`);
        } else {
            console.log('❌ Failed to get reports:', reportsData);
        }

        // 6. Fetch System Settings
        console.log('\n⚙️ Fetching System Settings...');
        const settingsRes = await fetch(`${API_URL}/admin/system-settings`, { headers });
        const settingsData = await settingsRes.json();
        console.log(`Response Status: ${settingsRes.status}`);
        if (settingsData.settings) {
            console.log('✅ Got system settings.');
        } else {
            console.log('❌ Failed to get settings:', settingsData);
        }

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        process.exit();
    }
}

verifyAdmin();
