// Простая тестовая функция для проверки работы Netlify Functions
exports.handler = async (event, context) => {
    console.log('=== TEST API FUNCTION CALLED ===');
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));
    console.log('Environment variables:', {
        NODE_ENV: process.env.NODE_ENV,
        NETLIFY: process.env.NETLIFY,
        NETLIFY_DEV: process.env.NETLIFY_DEV,
        hasYandexToken: !!process.env.YANDEX_OAUTH_TOKEN,
        hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN
    });
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const response = {
            success: true,
            message: 'Test API function is working!',
            timestamp: new Date().toISOString(),
            method: event.httpMethod,
            path: event.path,
            headers: event.headers,
            environment: {
                hasYandexToken: !!process.env.YANDEX_OAUTH_TOKEN,
                hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
                yandexTokenLength: process.env.YANDEX_OAUTH_TOKEN ? process.env.YANDEX_OAUTH_TOKEN.length : 0
            }
        };

        console.log('Returning response:', JSON.stringify(response, null, 2));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };
    } catch (error) {
        console.error('Error in test function:', error);
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
