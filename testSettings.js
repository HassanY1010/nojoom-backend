import jwt from 'jsonwebtoken';
import { jwtConfig } from './config/jwt.js';

async function testSettings() {
    const adminUser = {
        id: 20,
        email: 'admin@admin.com',
        role: 'admin'
    };

    const token = jwt.sign(
        adminUser,
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
    );

    console.log('🎫 Testing GET /api/admin/system-settings');
    try {
        const getRes = await fetch('http://localhost:3333/api/admin/system-settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const getData = await getRes.json();
        console.log('📥 GET Result:', JSON.stringify(getData, null, 2));

        if (getRes.ok) {
            console.log('\n🎫 Testing PUT /api/admin/system-settings');
            const putRes = await fetch('http://localhost:3333/api/admin/system-settings', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    settings: {
                        maintenance_mode: true,
                        chat_enabled: false
                    }
                })
            });
            const putData = await putRes.json();
            console.log('📤 PUT Result:', JSON.stringify(putData, null, 2));
        }
    } catch (error) {
        console.error('❌ Test Failed:', error.message);
    }
}

testSettings();
