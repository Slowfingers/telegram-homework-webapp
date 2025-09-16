// Simple in-memory storage solution for user data
// This is a temporary solution until we fix Yandex Disk integration

let users = new Map(); // In-memory storage

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { action, userData, telegramId } = JSON.parse(event.body || '{}');
        
        console.log('Simple storage action:', action);
        console.log('Data:', { userData, telegramId });

        switch (action) {
            case 'register':
                // Register new user
                const user = {
                    telegramId: userData.telegramId,
                    class: userData.class,
                    lastName: userData.lastName,
                    firstName: userData.firstName,
                    registrationDate: new Date().toISOString().split('T')[0]
                };
                
                users.set(userData.telegramId.toString(), user);
                console.log('User registered:', user);
                console.log('Total users:', users.size);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        message: 'User registered successfully',
                        user: user,
                        totalUsers: users.size
                    })
                };

            case 'check':
                // Check if user exists
                const existingUser = users.get(telegramId.toString());
                console.log('Checking user:', telegramId);
                console.log('Found user:', existingUser);
                console.log('All users:', Array.from(users.keys()));
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        user: existingUser || null,
                        totalUsers: users.size
                    })
                };

            case 'list':
                // List all users (for debugging)
                const allUsers = Array.from(users.values());
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        users: allUsers,
                        totalUsers: users.size
                    })
                };

            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: 'Invalid action. Use: register, check, or list'
                    })
                };
        }

    } catch (error) {
        console.error('Simple storage error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
