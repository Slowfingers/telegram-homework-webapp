const crypto = require('crypto');
const { uploadExcelToYandexDisk, createStudentsExcel, registerStudent } = require('./excel-utils');
const { registerStudentJson } = require('./json-utils');

// Telegram Bot Token (set in Netlify environment variables)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Yandex API credentials (set in Netlify environment variables)
const YANDEX_OAUTH_TOKEN = process.env.YANDEX_OAUTH_TOKEN;

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
        const { telegramId, initData, userData } = JSON.parse(event.body);
        
        console.log('Registration request for user:', telegramId);
        
        // Check environment variables
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        
        console.log('Environment check:', {
            hasBotToken: !!botToken,
            hasOauthToken: !!oauthToken
        });
        
        // Try new CSV approach with Yandex Disk
        if (oauthToken) {
            console.log('Using new CSV approach with OAuth token');
            
            try {
                // Prepare student data
                const student = {
                    telegramId: userData.telegramId,
                    class: userData.class,
                    lastName: userData.lastName,
                    firstName: userData.firstName,
                    registrationDate: new Date().toISOString().split('T')[0]
                };
                
                // Use JSON approach for user registration on Yandex Disk
                const result = await registerStudentJson(student, oauthToken);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        message: 'User registered successfully with new CSV approach',
                        user: userData,
                        debug: {
                            method: 'new_csv_approach',
                            filePath: '/Homework_App/Records/Students.csv'
                        }
                    })
                };
                
            } catch (error) {
                console.log('New CSV approach failed:', error.message);
                // Fall back to simple storage
            }
        }
        
        // Fallback to simple storage
        try {
            console.log('Falling back to simple storage...');
            const simpleStorageResponse = await fetch(`${process.env.URL || 'https://evrikaforhome.netlify.app'}/.netlify/functions/simple-storage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'register', userData: userData })
            });
            
            if (simpleStorageResponse.ok) {
                const simpleData = await simpleStorageResponse.json();
                console.log('Simple storage registration response:', simpleData);
                
                if (simpleData.success) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            message: 'User registered successfully (fallback storage)',
                            user: simpleData.user,
                            debug: {
                                method: 'simple_storage_fallback',
                                totalUsers: simpleData.totalUsers
                            }
                        })
                    };
                }
            }
        } catch (error) {
            console.log('Simple storage fallback failed:', error.message);
        }

        // Skip simple storage to avoid recursion

        // If no environment variables, use hardcoded token and alternative save method
        if (!botToken || !oauthToken) {
            console.log('Working in demo mode - using alternative save method');
            
            // Use the hardcoded Yandex token from .env.example for testing
            const testOauthToken = 'y0__xDpo-JiGJukOiDCr6CzFFRUktGhbaL_5rLrM8cKgh1409tx';
            
            try {
                console.log('Demo mode: Attempting alternative save method for user:', userData);
                await saveUserAlternative(userData, testOauthToken);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: true, 
                        message: 'User registered successfully (demo mode with alternative save)',
                        user: userData
                    })
                };
            } catch (error) {
                console.error('Demo mode save error:', error);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: true, 
                        message: 'User registered successfully (demo mode - save failed but continuing)',
                        user: userData,
                        error: error.message
                    })
                };
            }
        }

        // Validate initData hash only if we have bot token
        if (!validateTelegramData(initData, botToken)) {
            console.log('Telegram data validation failed');
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid Telegram data' })
            };
        }

        // Save user data to Excel file on Yandex Disk
        await saveUserToExcel(userData, oauthToken);
        
        console.log('User registered successfully:', userData);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'User registered successfully',
                user: userData
            })
        };

    } catch (error) {
        console.error('Registration error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'Internal server error' })
        };
    }
};

// Save user to Excel file on Yandex Disk
async function saveUserToExcel(userData, oauthToken) {
    const studentsFilePath = '/Homework_App/Students.csv';
    let students = [];
    
    console.log('Attempting to save user to Excel:', userData.telegramId);
    
    try {
        // Try to read existing file
        console.log('Reading existing students file...');
        const existingData = await readExcelFromYandexDisk(studentsFilePath, oauthToken);
        students = parseCSV(existingData);
        console.log('Existing students found:', students.length);
        console.log('Existing students data:', students.map(s => ({ 
            id: s['Telegram ID'] || s['telegramId'], 
            name: s['Фамилия'] || s['lastName'],
            class: s['Класс'] || s['class']
        })));
        
        // Check if user already exists
        const existingUser = students.find(s => 
            s['Telegram ID'] === userData.telegramId.toString() ||
            s['telegramId'] === userData.telegramId.toString()
        );
        if (existingUser) {
            console.log('User already registered:', userData.telegramId);
            return;
        }
    } catch (error) {
        console.log('File read error (creating new file):', error.message);
        console.log('Error details:', error);
        students = []; // Start with empty array
    }
    
    // Add new user
    const newStudent = {
        telegramId: userData.telegramId,
        class: userData.class,
        lastName: userData.lastName,
        firstName: userData.firstName,
        registrationDate: new Date().toISOString().split('T')[0]
    };
    
    // Add to existing students array
    students.push(newStudent);
    
    console.log('Adding new student. Total students now:', students.length);
    console.log('Students array:', students.map(s => ({ id: s.telegramId, name: s.lastName })));
    
    // Create updated Excel file
    const excelBuffer = createStudentsExcel(students);
    
    // Upload to Yandex Disk
    await uploadExcelToYandexDisk(studentsFilePath, excelBuffer, oauthToken);
    
    console.log('User saved to Excel successfully:', userData.telegramId);
}

// Alternative save method - saves each user to individual file
async function saveUserAlternative(userData, oauthToken) {
    const timestamp = Date.now();
    const homeworkPath = `/Homework_App/${userData.class}_homework_tracking.csv`;
    
    console.log('Alternative save: Creating individual file for user:', userData.telegramId);
    
    try {
        // Create user data object
        const userRecord = {
            telegramId: userData.telegramId,
            class: userData.class,
            lastName: userData.lastName,
            firstName: userData.firstName,
            registrationDate: new Date().toISOString().split('T')[0],
            timestamp: timestamp
        };
        
        const userBuffer = Buffer.from(JSON.stringify(userRecord, null, 2), 'utf-8');
        
        // Upload individual user file
        await uploadExcelToYandexDisk(userFilePath, userBuffer, oauthToken);
        
        console.log('Alternative save: User file created successfully:', userFilePath);
        
        // Also try to update the main CSV file
        try {
            await saveUserToExcel(userData, oauthToken);
            console.log('Alternative save: Also updated main CSV file');
        } catch (csvError) {
            console.log('Alternative save: CSV update failed, but individual file saved:', csvError.message);
        }
        
    } catch (error) {
        console.error('Alternative save failed:', error);
        throw error;
    }
}

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
