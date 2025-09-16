const crypto = require('crypto');
const https = require('https');

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
        const { telegramId, initData, submissionData, fileData } = JSON.parse(event.body);
        
        // Validate Telegram data
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, message: 'Bot token not configured' })
            };
        }

        // Get Yandex OAuth token
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        if (!oauthToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, message: 'Yandex OAuth token not configured' })
            };
        }

        // Upload file to class folder on Yandex Disk
        if (fileData) {
            const uploadResult = await uploadHomeworkFile(fileData, submissionData, oauthToken);
            if (!uploadResult.success) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'Failed to upload file' })
                };
            }
        }

        // Update homework tracking Excel file
        await updateHomeworkTracking(submissionData, oauthToken);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'Homework submitted successfully'
            })
        };

    } catch (error) {
        const homeworkDir = '/Homework_App/Homework_Submissions';
        console.error('Homework submission error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'Internal server error' })
        };
    }
};

// Upload homework file to class folder
async function uploadHomeworkFile(fileData, submissionData, oauthToken) {
    try {
        const { fileName, fileContent, fileType } = fileData;
        const { class: studentClass, lastName, firstName, assignmentDate, assignmentTopic } = submissionData;
        
        // Create file path in class folder
        const sanitizedTopic = assignmentTopic.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').substring(0, 50);
        const filePath = `/Homework_App/Homework_Submissions/${studentClass}/${assignmentDate}_${sanitizedTopic}/${lastName}_${firstName}_${fileName}`;
        
        // Convert base64 to buffer
        const fileBuffer = Buffer.from(fileContent, 'base64');
        
        // Upload to Yandex Disk
        await uploadFileToYandexDisk(filePath, fileBuffer, oauthToken);
        
        return { success: true, filePath };
    } catch (error) {
        console.error('File upload error:', error);
        return { success: false, error: error.message };
    }
}

// Upload file to Yandex Disk
async function uploadFileToYandexDisk(filePath, fileBuffer, oauthToken) {
    return new Promise((resolve, reject) => {
        // First, create directories if they don't exist
        createDirectoriesForPath(filePath, oauthToken).then(() => {
            // Get upload URL
            const options = {
                hostname: 'cloud-api.yandex.net',
                path: `/v1/disk/resources/upload?path=${encodeURIComponent(filePath)}&overwrite=true`,
                method: 'GET',
                headers: {
                    'Authorization': `OAuth ${oauthToken}`
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.href) {
                            // Upload file to the URL
                            uploadToUrl(response.href, fileBuffer).then(resolve).catch(reject);
                        } else {
                            reject(new Error('Failed to get upload URL'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.end();
        }).catch(reject);
    });
}

// Create directories for file path
async function createDirectoriesForPath(filePath, oauthToken) {
    const pathParts = filePath.split('/').slice(0, -1); // Remove filename
    let currentPath = '';
    
    for (const part of pathParts) {
        if (part) {
            currentPath += '/' + part;
            await createDirectory(currentPath, oauthToken);
        }
    }
}

// Create directory on Yandex Disk
function createDirectory(dirPath, oauthToken) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources?path=${encodeURIComponent(dirPath)}`,
            method: 'PUT',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        const req = https.request(options, (res) => {
            // Directory creation can fail if it already exists, which is fine
            resolve();
        });

        req.on('error', () => {
            // Ignore errors (directory might already exist)
            resolve();
        });
        req.end();
    });
}

// Upload file to URL
function uploadToUrl(url, fileBuffer) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'PUT',
            headers: {
                'Content-Length': fileBuffer.length
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve();
            } else {
                reject(new Error(`Upload failed: ${res.statusCode}`));
            }
        });

        req.on('error', reject);
        req.write(fileBuffer);
        req.end();
    });
}

// Update homework tracking Excel file
async function updateHomeworkTracking(submissionData, oauthToken) {
    try {
        const { class: userClass } = submissionData;
        const trackingFilePath = `/Homework_App/${userClass}_homework_tracking.csv`;
        let trackingData = [];
        
        try {
            // Try to read existing tracking file
            const existingData = await readExcelFromYandexDisk(trackingFilePath, oauthToken);
            trackingData = parseCSV(existingData);
        } catch (error) {
            console.log('Creating new tracking file:', error.message);
        }
        
        // Find or create record for this student and assignment
        const { class: studentClass, lastName, firstName, telegramId, assignmentDate, assignmentTopic } = submissionData;
        const assignmentKey = `${assignmentDate}_${assignmentTopic}`;
        
        let studentRecord = trackingData.find(record => 
            record['Telegram ID'] === telegramId.toString() && 
            record['Задание'] === assignmentKey
        );
        
        if (studentRecord) {
            // Update existing record
            studentRecord['Статус'] = 'Сдано';
            studentRecord['Дата сдачи'] = new Date().toISOString().split('T')[0];
        } else {
            // Create new record
            trackingData.push({
                'Telegram ID': telegramId,
                'Класс': studentClass,
                'Фамилия': lastName,
                'Имя': firstName,
                'Задание': assignmentKey,
                'Статус': 'Сдано',
                'Дата сдачи': new Date().toISOString().split('T')[0]
            });
        }
        
        // Create updated CSV content
        const headers = 'Telegram ID,Класс,Фамилия,Имя,Задание,Статус,Дата сдачи\n';
        const rows = trackingData.map(record => 
            `${record['Telegram ID']},"${record['Класс']}","${record['Фамилия']}","${record['Имя']}","${record['Задание']}","${record['Статус']}","${record['Дата сдачи']}"`
        ).join('\n');
        
        const csvBuffer = Buffer.from(headers + rows, 'utf-8');
        
        // Upload updated tracking file
        await uploadFileToYandexDisk(trackingFilePath, csvBuffer, oauthToken);
        
        console.log('Homework tracking updated for:', telegramId);
    } catch (error) {
        console.error('Error updating homework tracking:', error);
        // Don't throw error - submission should still succeed even if tracking fails
    }
}
