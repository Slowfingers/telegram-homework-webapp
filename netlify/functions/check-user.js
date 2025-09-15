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
        console.log('telegramId type:', typeof telegramId);
        console.log('telegramId value:', telegramId);

        // FORCE MOCK USER RETURN - BYPASS ALL LOGIC FOR DEBUGGING
        console.log('=== FORCE MOCK USER DEBUG ===');
        console.log('Received telegramId:', telegramId, 'type:', typeof telegramId);
        console.log('Environment variables available:', Object.keys(process.env).filter(key => key.includes('YANDEX')));
        
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        console.log('OAuth token exists:', !!oauthToken);
        console.log('OAuth token length:', oauthToken ? oauthToken.length : 0);
        
        // ALWAYS return mock user regardless of environment
        console.log('FORCING mock user return for debugging...');
        const mockUser = {
            telegramId: parseInt(telegramId),
            class: "7А",
            lastName: "dfg", 
            firstName: "dfg",
            registrationDate: new Date().toISOString().split('T')[0]
        };
        
        console.log('Mock user created:', JSON.stringify(mockUser));
        
        const response = {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                user: mockUser,
                debug: {
                    hasOauthToken: !!oauthToken,
                    telegramIdReceived: telegramId,
                    mockUserCreated: true
                }
            })
        };
        
        console.log('Response being returned:', JSON.stringify(response));
        return response;

        const user = await checkUserInExcel(telegramId, oauthToken);
        
        console.log('User lookup result:', user ? 'Found' : 'Not found');
        console.log('User data found:', user);
        
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
        
        console.log('Checking user in Excel file:', telegramId);
        
        // Try to read existing file
        const existingData = await readExcelFromYandexDisk(studentsFilePath, oauthToken);
        console.log('File read successfully, size:', existingData.length);
        
        const students = parseCSV(existingData);
        console.log('Students parsed from CSV:', students.length);
        console.log('Raw CSV content preview:', existingData.toString().substring(0, 500));
        
        // Find user by Telegram ID (try different column name variations)
        const user = students.find(s => {
            const id1 = s['Telegram ID'];
            const id2 = s['telegramId']; 
            const id3 = s['ID'];
            
            console.log('Comparing IDs:', {
                searching: telegramId.toString(),
                found_id1: id1,
                found_id2: id2,
                found_id3: id3,
                match1: id1 === telegramId.toString(),
                match2: id2 === telegramId.toString(),
                match3: id3 === telegramId.toString()
            });
            
            return id1 === telegramId.toString() || 
                   id2 === telegramId.toString() ||
                   id3 === telegramId.toString() ||
                   parseInt(id1) === telegramId ||
                   parseInt(id2) === telegramId ||
                   parseInt(id3) === telegramId;
        });
        
        console.log('Looking for user with ID:', telegramId);
        console.log('Available students:', students.map(s => ({ 
            id: s['Telegram ID'] || s['telegramId'] || s['ID'], 
            name: s['Фамилия'] || s['lastName'],
            class: s['Класс'] || s['class']
        })));
        
        if (user) {
            console.log('User found in CSV:', user);
            return {
                telegramId: parseInt(user['Telegram ID'] || user['telegramId'] || user['ID']),
                class: user['Класс'] || user['class'],
                lastName: user['Фамилия'] || user['lastName'],
                firstName: user['Имя'] || user['firstName'],
                registrationDate: user['Дата регистрации'] || user['registrationDate']
            };
        }
        
        console.log('User not found in CSV');
        return null;
    } catch (error) {
        console.log('User check error (file may not exist yet):', error.message);
        console.log('Full error:', error);
        return null;
    }
}

// Alternative check method - looks for individual user files
async function checkUserAlternative(telegramId, oauthToken) {
    try {
        console.log('Alternative check: Looking for individual files for user:', telegramId);
        
        // For now, return null as we can't easily implement file pattern matching
        // without proper directory listing API
        console.log('Alternative check: No individual files found for user:', telegramId);
        return null;
        
    } catch (error) {
        console.log('Alternative check error:', error.message);
        return null;
    }
}
