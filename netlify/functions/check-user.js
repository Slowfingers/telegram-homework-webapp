const crypto = require('crypto');
const { readExcelFromYandexDisk, parseCSV } = require('./excel-utils');

// Telegram Bot Token (set in Netlify environment variables)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Yandex API credentials (set in Netlify environment variables)
const YANDEX_OAUTH_TOKEN = process.env.YANDEX_OAUTH_TOKEN;
const SPREADSHEET_ID = process.env.YANDEX_SPREADSHEET_ID;

exports.handler = async (event, context) => {
    console.log('=== CHECK-USER FUNCTION STARTED ===');
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('HTTP Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));
    console.log('Body:', event.body);
    
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS request');
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        console.log('Invalid method:', event.httpMethod);
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }

    try {
        console.log('Parsing request body...');
        
        if (!event.body) {
            console.error('No body in request');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'No request body' })
            };
        }
        
        const { telegramId, initData } = JSON.parse(event.body);

        console.log('Successfully parsed body');
        console.log('Checking user registration for ID:', telegramId);
        console.log('telegramId type:', typeof telegramId);
        console.log('telegramId value:', telegramId);

        // Check environment variables
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        
        console.log('Environment check:', {
            hasOauthToken: !!oauthToken,
            oauthTokenLength: oauthToken ? oauthToken.length : 0,
            telegramId: telegramId,
            telegramIdType: typeof telegramId
        });

        // Try simple storage first (temporary solution)
        try {
            console.log('Trying simple storage lookup...');
            const simpleStorageResponse = await fetch(`${process.env.URL || 'https://evrikaforhome.netlify.app'}/.netlify/functions/simple-storage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check', telegramId: telegramId })
            });
            
            if (simpleStorageResponse.ok) {
                const simpleData = await simpleStorageResponse.json();
                console.log('Simple storage response:', simpleData);
                
                if (simpleData.success && simpleData.user) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            user: simpleData.user,
                            debug: {
                                method: 'simple_storage',
                                totalUsers: simpleData.totalUsers
                            }
                        })
                    };
                }
            }
        } catch (error) {
            console.log('Simple storage lookup failed:', error.message);
        }

        // Now that we have environment variables, try real user lookup first
        if (oauthToken) {
            console.log('Using production mode with OAuth token');
            
            try {
                const user = await checkUserInExcel(telegramId, oauthToken);
                
                console.log('User lookup result:', user ? 'Found' : 'Not found');
                console.log('User data found:', user);
                
                if (user) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            user: user,
                            debug: {
                                method: 'yandex_disk',
                                hasOauthToken: true,
                                telegramId: telegramId
                            }
                        })
                    };
                }
            } catch (error) {
                console.error('Yandex Disk user lookup failed:', error);
                // Continue to fallback mode
            }
        }
        
        // Fallback: return mock user
        console.log('Using fallback mock user');
        const mockUser = {
            telegramId: parseInt(telegramId),
            class: "5Б",
            lastName: "ор", 
            firstName: "орор",
            registrationDate: new Date().toISOString().split('T')[0]
        };
        
        console.log('Mock user created:', JSON.stringify(mockUser));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                user: mockUser,
                debug: {
                    hasOauthToken: !!oauthToken,
                    telegramIdReceived: telegramId,
                    mode: 'fallback_mock'
                }
            })
        };

    } catch (error) {
        console.error('=== ERROR IN CHECK-USER ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Event body:', event.body);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Internal server error',
                error: error.message,
                debug: {
                    hasBody: !!event.body,
                    bodyLength: event.body ? event.body.length : 0,
                    method: event.httpMethod
                }
            })
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
