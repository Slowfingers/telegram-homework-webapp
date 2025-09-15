const crypto = require('crypto');

// Telegram Bot Token (set in Netlify environment variables)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Yandex API credentials (set in Netlify environment variables)
const YANDEX_OAUTH_TOKEN = process.env.YANDEX_OAUTH_TOKEN;
const SPREADSHEET_ID = process.env.YANDEX_SPREADSHEET_ID;

exports.handler = async (event, context) => {
    // Enable CORS
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
        const { telegramId, initData } = JSON.parse(event.body);

        // Validate Telegram data
        if (!validateTelegramData(initData)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid Telegram data' })
            };
        }

        // Check if user exists in Yandex Tables
        const user = await checkUserInDatabase(telegramId);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                user: user
            })
        };

    } catch (error) {
        console.error('Error in check-user:', error);
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

// Check if user exists in Yandex Tables
async function checkUserInDatabase(telegramId) {
    try {
        const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=/Homework_App/roster.xlsx&fields=file`, {
            headers: {
                'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to access Yandex Disk');
        }

        // For now, return null (user not found) to trigger registration
        // In a real implementation, you would parse the Excel file and check for the user
        // This is a simplified version - you might want to use a proper database instead
        
        return null; // User not found, needs registration
    } catch (error) {
        console.error('Database check error:', error);
        return null;
    }
}
