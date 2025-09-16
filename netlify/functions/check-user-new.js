const { downloadCsv, getUser } = require('./excel-utils');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { telegramId, initData } = JSON.parse(event.body);
        
        console.log('=== CHECK USER NEW ===');
        console.log('TelegramId:', telegramId);
        
        if (!telegramId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'TelegramId is required'
                })
            };
        }

        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        if (!oauthToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'OAuth token not configured'
                })
            };
        }

        // Поиск пользователя в /Homework_App/Students.csv
        const filePath = "/Homework_App/Students.csv";
        const user = await getUser(telegramId, oauthToken, filePath);
        
        console.log('User found:', !!user);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                user: user,
                debug: {
                    method: 'csv_lookup',
                    filePath: filePath
                }
            })
        };
        
    } catch (error) {
        console.error('Check user error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Internal server error',
                error: error.message
            })
        };
    }
};
