const { getGoogleSheetsClient, getSpreadsheetId, getTeacher } = require('./google-sheets-utils');
const crypto = require('crypto');

// Telegram Bot Token (set in Netlify environment variables)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Admin ID (your Telegram ID)
const ADMIN_ID = '330977942'; // TODO: Replace with your actual Telegram ID

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight request
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
        const { telegramId, lastName, firstName, subject, classes, role, initData, adminId } = JSON.parse(event.body);

        // Validate required fields
        if (!telegramId || !lastName || !firstName || !subject) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'Missing required fields' })
            };
        }

        // Validate that the request is coming from admin
        if (adminId != ADMIN_ID) { // Use loose equality for string/number comparison
            // Validate Telegram data if provided
            if (initData && !validateTelegramData(initData)) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, message: 'Invalid Telegram data' })
                };
            }

            // Check if the user initiating the request is admin
            if (adminId != ADMIN_ID) { // Use loose equality for string/number comparison
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ success: false, message: 'Only admins can register teachers' })
                };
            }
        }

        // Check if teacher already exists
        const existingTeacher = await getTeacher(telegramId);
        
        // Get Google Sheets client
        const sheets = getGoogleSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        
        // Format classes as comma-separated list
        const classesValue = Array.isArray(classes) ? classes.join(', ') : classes;
        
        if (existingTeacher) {
            // Update existing teacher
            const range = `Teachers!A${existingTeacher.rowIndex}:F${existingTeacher.rowIndex}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[telegramId, lastName, firstName, subject, classesValue, role || 'teacher']]
                }
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Teacher updated successfully',
                    isNew: false,
                    teacher: {
                        telegramId,
                        lastName,
                        firstName,
                        subject,
                        classes: Array.isArray(classes) ? classes : classesValue.split(',').map(c => c.trim()),
                        role: role || 'teacher'
                    }
                })
            };
        } else {
            // Get all teachers to determine next row
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Teachers!A:F'
            });
            
            const rows = response.data.values || [];
            const nextRow = rows.length + 1;
            
            // Add new teacher
            const range = `Teachers!A${nextRow}:F${nextRow}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[telegramId, lastName, firstName, subject, classesValue, role || 'teacher']]
                }
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Teacher registered successfully',
                    isNew: true,
                    teacher: {
                        telegramId,
                        lastName,
                        firstName,
                        subject,
                        classes: Array.isArray(classes) ? classes : classesValue.split(',').map(c => c.trim()),
                        role: role || 'teacher'
                    }
                })
            };
        }
    } catch (error) {
        console.error('Error registering teacher:', error);
        
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
