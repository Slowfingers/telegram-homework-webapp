const crypto = require('crypto');
const multipart = require('lambda-multipart-parser');

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
        // Parse multipart form data
        const result = await multipart.parse(event);
        
        const { telegramId, class: userClass, lastName, firstName, initData } = result;
        const file = result.file;

        // Validate required fields
        if (!telegramId || !userClass || !lastName || !firstName || !file) {
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

        // Validate file size (max 10MB)
        if (file.content.length > 10 * 1024 * 1024) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'File size exceeds 10MB limit' })
            };
        }

        // Upload file to Yandex Disk
        const uploadResult = await uploadFileToYandexDisk(file, userClass, lastName, firstName, telegramId);
        
        if (uploadResult.success) {
            // Save submission record to database
            await saveSubmissionRecord({
                telegramId,
                class: userClass,
                lastName,
                firstName,
                fileName: file.filename,
                filePath: uploadResult.filePath,
                submissionDate: new Date().toISOString()
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Homework submitted successfully',
                    filePath: uploadResult.filePath
                })
            };
        } else {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, message: 'Failed to upload file' })
            };
        }

    } catch (error) {
        console.error('Error in submit-homework:', error);
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

// Upload file to Yandex Disk
async function uploadFileToYandexDisk(file, userClass, lastName, firstName, telegramId) {
    try {
        // Create class directory if it doesn't exist
        const classPath = `/Homework_App/Submissions/${userClass}`;
        await createDirectoryIfNotExists(classPath);

        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileExtension = file.filename.split('.').pop();
        const uniqueFileName = `${lastName}_${firstName}_${telegramId}_${timestamp}.${fileExtension}`;
        const filePath = `${classPath}/${uniqueFileName}`;

        // Get upload URL
        const uploadResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(filePath)}&overwrite=true`, {
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
            body: file.content,
            headers: {
                'Content-Type': file.contentType || 'application/octet-stream'
            }
        });

        if (fileUploadResponse.ok) {
            return {
                success: true,
                filePath: filePath
            };
        } else {
            throw new Error('Failed to upload file');
        }

    } catch (error) {
        console.error('File upload error:', error);
        return {
            success: false,
            error: error.message
        };
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

// Save submission record to database
async function saveSubmissionRecord(submissionData) {
    try {
        // Create submissions directory if it doesn't exist
        await createDirectoryIfNotExists('/Homework_App/Records');
        
        // Create submission record
        const recordText = `${submissionData.telegramId},${submissionData.class},${submissionData.lastName},${submissionData.firstName},${submissionData.fileName},${submissionData.filePath},${submissionData.submissionDate}\n`;
        
        // Upload submission record to Yandex Disk
        const recordFileName = `submission_${submissionData.telegramId}_${Date.now()}.txt`;
        const uploadResponse = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/upload?path=/Homework_App/Records/${recordFileName}&overwrite=true`, {
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
            }
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to get upload URL for record');
        }

        const uploadData = await uploadResponse.json();
        
        // Upload the record content
        const fileUploadResponse = await fetch(uploadData.href, {
            method: 'PUT',
            body: recordText,
            headers: {
                'Content-Type': 'text/plain'
            }
        });

        return fileUploadResponse.ok;
    } catch (error) {
        console.error('Record save error:', error);
        return false;
    }
}
