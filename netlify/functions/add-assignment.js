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
        const { telegramId, initData, assignmentData } = JSON.parse(event.body);

        // Validate Telegram data
        if (!validateTelegramData(initData)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid Telegram data' })
            };
        }

        // Check if user is admin (simplified check)
        const isAdmin = await checkAdminStatus(telegramId);
        if (!isAdmin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, message: 'Access denied' })
            };
        }

        // Add assignment to database
        const result = await addAssignmentToDatabase(assignmentData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Assignment added successfully',
                assignmentId: result.id
            })
        };

    } catch (error) {
        console.error('Error in add-assignment:', error);
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

// Check if user is admin
async function checkAdminStatus(telegramId) {
    // For demo purposes, you can hardcode admin IDs here
    // In production, this should be stored in your database
    const adminIds = [
        // Add admin Telegram IDs here
        // Example: 123456789
    ];
    
    return adminIds.includes(parseInt(telegramId));
}

// Add assignment to database
async function addAssignmentToDatabase(assignmentData) {
    try {
        // Create assignment folder structure on Yandex Disk
        const folderPath = `/Homework_App/assignments/${assignmentData.class}`;
        
        // Ensure folder exists
        await createFolderIfNotExists(folderPath);
        
        // Create assignment file
        const assignmentId = Date.now().toString();
        const assignmentFile = {
            id: assignmentId,
            date: assignmentData.date,
            class: assignmentData.class,
            topic: assignmentData.topic,
            description: assignmentData.description,
            materialLink: assignmentData.materialLink || '',
            createdAt: new Date().toISOString()
        };
        
        const filePath = `${folderPath}/assignment_${assignmentId}.json`;
        
        // Upload assignment data as JSON file
        const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(filePath)}`, {
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get upload URL');
        }
        
        const uploadData = await response.json();
        
        // Upload the file content
        const uploadResponse = await fetch(uploadData.href, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assignmentFile)
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload assignment');
        }
        
        return { id: assignmentId };
        
    } catch (error) {
        console.error('Database error:', error);
        throw error;
    }
}

// Create folder if it doesn't exist
async function createFolderIfNotExists(path) {
    try {
        const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`, {
            headers: {
                'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
            }
        });
        
        if (response.status === 404) {
            // Folder doesn't exist, create it
            const createResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
                }
            });
            
            if (!createResponse.ok) {
                throw new Error('Failed to create folder');
            }
        }
    } catch (error) {
        console.error('Folder creation error:', error);
        throw error;
    }
}
