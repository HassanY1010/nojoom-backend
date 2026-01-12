import jwt from 'jsonwebtoken';
import { jwtConfig } from './config/jwt.js';

async function testStats() {
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

    console.log('🎫 Generated Token:', token);

    try {
        const response = await fetch('http://localhost:3333/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Response:', JSON.stringify(data, null, 2));
        } else {
            console.error('❌ Error:', response.status, data);
        }
    } catch (error) {
        console.error('❌ Request Failed:', error.message);
    }
}

testStats();
