// Test function to debug registration process
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
        console.log('=== TEST REGISTER FUNCTION ===');
        console.log('Method:', event.httpMethod);
        console.log('Headers:', event.headers);
        console.log('Body:', event.body);
        
        // Test data
        const testUserData = {
            telegramId: 123456789,
            class: "Test Class",
            lastName: "Test Last",
            firstName: "Test First"
        };
        
        console.log('Test user data:', testUserData);
        
        // Check environment variables
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        console.log('Environment check:', {
            hasOauthToken: !!oauthToken,
            oauthTokenLength: oauthToken ? oauthToken.length : 0
        });
        
        if (!oauthToken) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'No OAuth token available',
                    debug: { hasToken: false }
                })
            };
        }
        
        // Try to call the actual register function logic
        const { saveUserToExcel } = require('./register-user');
        
        try {
            await saveUserToExcel(testUserData, oauthToken);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Test registration completed',
                    testUser: testUserData,
                    debug: {
                        hasToken: true,
                        tokenLength: oauthToken.length
                    }
                })
            };
            
        } catch (saveError) {
            console.error('Save error:', saveError);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Save failed',
                    error: saveError.message,
                    stack: saveError.stack,
                    debug: {
                        hasToken: true,
                        tokenLength: oauthToken.length
                    }
                })
            };
        }
        
    } catch (error) {
        console.error('Test register error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    }
};
