const { getGoogleSheetsClient } = require('./google-sheets-utils');

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
        const { telegramId, lastName, firstName, subject, classes, role } = JSON.parse(event.body);

        if (!telegramId || !lastName || !firstName || !role) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Missing required fields: telegramId, lastName, firstName, role' 
                })
            };
        }

        // Only allow admin or teacher roles
        if (!['admin', 'teacher'].includes(role)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Invalid role. Must be admin or teacher' 
                })
            };
        }

        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // Check if Teachers sheet exists and has any admins
        try {
            const existingTeachers = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Teachers!A:F'
            });

            const rows = existingTeachers.data.values || [];
            
            // If there are already admins in the system, don't allow this function
            if (rows.length > 1) { // More than just header row
                const hasAdmin = rows.slice(1).some(row => row[5] === 'admin');
                if (hasAdmin) {
                    return {
                        statusCode: 403,
                        headers,
                        body: JSON.stringify({ 
                            success: false, 
                            message: 'Admin already exists. Use regular registration.' 
                        })
                    };
                }
            }
        } catch (error) {
            // If Teachers sheet doesn't exist, that's fine - we'll create the first entry
            console.log('Teachers sheet may not exist yet, proceeding with first admin registration');
        }

        // Prepare the row data
        const classesString = Array.isArray(classes) ? classes.join(',') : classes || '';
        const rowData = [
            telegramId.toString(),
            lastName,
            firstName,
            subject || '',
            classesString,
            role
        ];

        // Add the teacher/admin to the Teachers sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Teachers!A:F',
            valueInputOption: 'RAW',
            resource: {
                values: [rowData]
            }
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `First ${role} registered successfully!`,
                teacher: {
                    telegramId,
                    lastName,
                    firstName,
                    subject: subject || '',
                    classes: classesString,
                    role
                }
            })
        };

    } catch (error) {
        console.error('Error registering first admin:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Internal server error',
                error: error.message
            })
        };
    }
};
