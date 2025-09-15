const crypto = require('crypto');
const { readExcelFromYandexDisk, parseCSV } = require('./excel-utils');

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

        console.log('Checking user registration for ID:', telegramId);

        // Check environment variables
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        
        console.log('Environment check:', {
            hasOauthToken: !!oauthToken
        });

        // If no OAuth token, return user not found (will trigger registration)
        if (!oauthToken) {
            console.log('Working in demo mode - OAuth token not configured');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    user: null // User not found, needs registration
                })
            };
        }

        const user = await checkUserInExcel(telegramId, oauthToken);
        
        console.log('User lookup result:', user ? 'Found' : 'Not found');
        
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

// Check if user exists in Excel file on Yandex Disk
async function checkUserInExcel(telegramId, oauthToken) {
    try {
        const studentsFilePath = '/Домашки/Students.csv';
        
        // Try to read existing file
        const existingData = await readExcelFromYandexDisk(studentsFilePath, oauthToken);
        const students = parseCSV(existingData);
        
        // Find user by Telegram ID (try different column name variations)
        const user = students.find(s => 
            s['Telegram ID'] === telegramId.toString() || 
            s['telegramId'] === telegramId.toString() ||
            s['ID'] === telegramId.toString()
        );
        
        console.log('Looking for user with ID:', telegramId);
        console.log('Available students:', students.map(s => ({ id: s['Telegram ID'] || s['telegramId'], name: s['Фамилия'] || s['lastName'] })));
        
        if (user) {
            return {
                telegramId: parseInt(user['Telegram ID'] || user['telegramId']),
                class: user['Класс'] || user['class'],
                lastName: user['Фамилия'] || user['lastName'],
                firstName: user['Имя'] || user['firstName'],
                registrationDate: user['Дата регистрации'] || user['registrationDate']
            };
        }
        
        return null; // User not found
    } catch (error) {
        console.log('User check error (file may not exist yet):', error.message);
        return null; // User not found or file doesn't exist
    }
}
