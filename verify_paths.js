
// Verified using global fetch (Node 18+)

const BASE_URL = 'http://localhost:5000/api';
// You might need to change this if 'hassan' doesn't exist. "admin" is usually safe if created.
const USERNAME = 'hassan';

async function verifyProfilePaths() {
    try {
        console.log(`Checking profile for ${USERNAME}...`);
        const response = await fetch(`${BASE_URL}/users/profile/${USERNAME}`);

        if (!response.ok) {
            console.error(`Failed to fetch profile: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Response:', text);
            return;
        }

        const data = await response.json();
        const { user, videos } = data;

        if (!user) {
            console.error('User not found in response');
            return;
        }

        console.log('--- User Profile ---');
        console.log('User ID:', user.id);
        console.log('User Avatar:', user.avatar);
        if (user.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://'))) {
            console.log('✅ Avatar has full URL');
        } else {
            console.error('❌ Avatar does NOT have full URL');
        }

        console.log('Social Links:', user.social_links);
        if (typeof user.social_links === 'object') {
            console.log('✅ Social links are parsed as object');
        } else {
            console.error('❌ Social links are NOT an object');
        }

        if (videos && videos.length > 0) {
            console.log(`\n--- Videos (from usersController) ---`);
            const firstVideo = videos[0];
            console.log('Video URL:', firstVideo.video_url);
            console.log('Thumbnail:', firstVideo.thumbnail);

            if (firstVideo.video_url && firstVideo.video_url.startsWith('http')) {
                console.log('✅ Video URL is full path');
            } else {
                console.error('❌ Video URL is NOT full path');
            }

            if (firstVideo.thumbnail && firstVideo.thumbnail.startsWith('http')) {
                console.log('✅ Video Thumbnail is full path');
            } else {
                console.error('❌ Video Thumbnail is NOT full path');
            }
        } else {
            console.warn('⚠️ No videos found in profile to verify.');
        }

        // Check videoRoutes (getUserVideos)
        console.log(`\n--- Checking videoRoutes (/videos/user/${user.id}) ---`);
        const vidResponse = await fetch(`${BASE_URL}/videos/user/${user.id}`);
        if (vidResponse.ok) {
            const vidData = await vidResponse.json();
            const userVideos = vidData.videos;
            if (userVideos && userVideos.length > 0) {
                const v = userVideos[0];
                console.log('Video URL:', v.video_url);
                console.log('Thumbnail:', v.thumbnail);
                console.log('Owner Avatar:', v.avatar);

                if (v.video_url && v.video_url.startsWith('http')) {
                    console.log('✅ Video URL is full path');
                } else {
                    console.error('❌ Video URL is NOT full path');
                }

                if (v.thumbnail && v.thumbnail.startsWith('http')) {
                    console.log('✅ Video Thumbnail is full path');
                } else {
                    console.error('❌ Video Thumbnail is NOT full path');
                }

                if (v.avatar && v.avatar.startsWith('http')) {
                    console.log('✅ Owner Avatar is full path');
                } else {
                    console.error('❌ Owner Avatar is NOT full path');
                }

            } else {
                console.warn('No videos found in videoRoutes endpoint');
            }
        } else {
            console.error('Failed to fetch user videos from videoRoutes');
        }

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verifyProfilePaths();
