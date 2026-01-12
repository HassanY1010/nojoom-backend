
const BASE_URL = 'http://localhost:5000/api';
// Use a test user or the logged in user token if possible. 
// Since we don't have a token generator here easily without login, 
// we will assume the manual test in browser is primary, but we can standardly test if endpoints 404.
// Actually, we can try to login as hassan first to get a token.

async function verifySettingsEndpoints() {
    console.log('--- Verifying Settings Endpoints Existence ---');

    const endpoints = [
        { method: 'GET', url: `${BASE_URL}/users/privacy-settings` },
        { method: 'PUT', url: `${BASE_URL}/users/privacy-settings` },
        { method: 'PUT', url: `${BASE_URL}/users/appearance` },
        { method: 'PUT', url: `${BASE_URL}/users/change-password` },
        { method: 'DELETE', url: `${BASE_URL}/users/account` }
    ];

    for (const ep of endpoints) {
        try {
            // We expect 401 Unauthorized if the endpoint exists but we are not logged in.
            // We expect 404 if the endpoint does NOT exist.
            const response = await fetch(ep.url, { method: ep.method });

            if (response.status === 404) {
                console.error(`❌ Endpoint MISSING: ${ep.method} ${ep.url}`);
            } else if (response.status === 401) {
                console.log(`✅ Endpoint Exists (Protected): ${ep.method} ${ep.url}`);
            } else {
                console.log(`✅ Endpoint Exists (Status ${response.status}): ${ep.method} ${ep.url}`);
            }
        } catch (error) {
            console.error(`Error checking ${ep.url}:`, error.message);
        }
    }
}

verifySettingsEndpoints();
