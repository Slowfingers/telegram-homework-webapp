const { registerStudent } = require('./google-sheets-utils');
const crypto = require('crypto');

// Telegram Bot Token (set in Netlify environment variables)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }

    try {
        const { telegramId, class: classGroup, lastName, firstName, initData } = JSON.parse(event.body);

        // Validate required fields
        if (!telegramId || !classGroup || !lastName || !firstName) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'Missing required fields' })
            };
        }

        // Validate Telegram data if provided
        if (initData && !validateTelegramData(initData)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid Telegram data' })
            };
        }

        // Register student in Google Sheets
        const result = await registerStudent(telegramId, classGroup, lastName, firstName);

        if (result.success) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        } else {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, message: result.message || 'Failed to register student' })
            };
        }
    } catch (error) {
        console.error('Error in register-student:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'Internal server error' })
        };
    }
};

// Validate Telegram WebApp data
function validateTelegramData(initData) {
    if (!initData || !BOT_TOKEN) {
        return false;
    }

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        // Check hash
        if (calculatedHash !== hash) {
            return false;
        }

        // Check auth_date (data should not be older than 24 hours)
        const authDate = parseInt(urlParams.get('auth_date'));
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime - authDate > 86400) { // 24 hours
            return false;
        }

        return true;
    } catch (error) {
        console.error('Telegram validation error:', error);
        return false;
    }
}
