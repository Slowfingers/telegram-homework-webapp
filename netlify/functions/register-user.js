const crypto = require('crypto');

// Telegram Bot Token (set in Netlify environment variables)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Yandex API credentials (set in Netlify environment variables)
const YANDEX_OAUTH_TOKEN = process.env.YANDEX_OAUTH_TOKEN;

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
        const { telegramId, class: userClass, lastName, firstName, initData } = JSON.parse(event.body);

        // Validate required fields
        if (!telegramId || !userClass || !lastName || !firstName) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'Missing required fields' })
            };
        }

        // Validate Telegram data
        if (!validateTelegramData(initData)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid Telegram data' })
            };
        }

        // Save user to Yandex Tables
        const success = await saveUserToDatabase({
            telegramId,
            class: userClass,
            lastName,
            firstName,
            registrationDate: new Date().toISOString()
        });

        if (success) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'User registered successfully'
                })
            };
        } else {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, message: 'Failed to register user' })
            };
        }

    } catch (error) {
        console.error('Error in register-user:', error);
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

// Save user to Yandex Tables (simplified implementation)
async function saveUserToDatabase(userData) {
    try {
        // Create roster directory if it doesn't exist
        await createDirectoryIfNotExists('/Homework_App');
        
        // In a real implementation, you would:
        // 1. Read the existing roster.xlsx file from Yandex Disk
        // 2. Add the new user data
        // 3. Upload the updated file back to Yandex Disk
        
        // For now, we'll create a simple text file with user data
        const userDataText = `${userData.telegramId},${userData.class},${userData.lastName},${userData.firstName},${userData.registrationDate}\n`;
        
        // Upload user data to Yandex Disk
        const uploadResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=/Homework_App/roster_${userData.telegramId}.txt&overwrite=true`, {
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
            }
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to get upload URL');
        }

        const uploadData = await uploadResponse.json();
        
        // Upload the file content
        const fileUploadResponse = await fetch(uploadData.href, {
            method: 'PUT',
            body: userDataText,
            headers: {
                'Content-Type': 'text/plain'
            }
        });

        return fileUploadResponse.ok;
    } catch (error) {
        console.error('Database save error:', error);
        return false;
    }
}

// Create directory in Yandex Disk if it doesn't exist
async function createDirectoryIfNotExists(path) {
    try {
        const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`, {
            headers: {
                'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
            }
        });

        if (response.status === 404) {
            // Directory doesn't exist, create it
            const createResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
                }
            });
            return createResponse.ok;
        }

        return response.ok;
    } catch (error) {
        console.error('Directory creation error:', error);
        return false;
    }
}
