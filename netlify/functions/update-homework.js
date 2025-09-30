const { getGoogleSheetsClient, isAdmin } = require('./google-sheets-utils');
const { getSecurityHeaders } = require('./security-headers');
const { checkRateLimit } = require('./rate-limiter');

exports.handler = async (event, context) => {
    // Set CORS headers with security headers
    const headers = getSecurityHeaders();

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
        const { homeworkId, adminId, description, deadline } = JSON.parse(event.body);

        // Validate required fields
        if (!homeworkId || !adminId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Missing required fields: homeworkId, adminId' 
                })
            };
        }

        // Check rate limit
        const rateCheck = checkRateLimit(adminId, 'add-homework');
        if (!rateCheck.allowed) {
            return {
                statusCode: 429,
                headers: {
                    ...headers,
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': rateCheck.resetTime.toString()
                },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Слишком много запросов. Попробуйте через минуту.' 
                })
            };
        }

        // Check if user is admin or teacher
        const admin = await isAdmin(adminId);
        if (!admin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Access denied. Admin or teacher role required.' 
                })
            };
        }

        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // Get existing homework
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Homework!A:F'
        });

        const rows = response.data.values || [];
        let homeworkFound = false;
        let rowIndex = -1;

        // Find the homework row
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === homeworkId) {
                homeworkFound = true;
                rowIndex = i + 1; // Sheets is 1-indexed
                break;
            }
        }

        if (!homeworkFound) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Homework not found' 
                })
            };
        }

        // Get current homework data
        const currentHomework = rows[rowIndex - 1];
        
        // Update only the fields that are provided
        const updatedRow = [
            currentHomework[0], // ID
            currentHomework[1], // Class
            currentHomework[2], // Subject
            description !== undefined ? description : currentHomework[3], // Description
            deadline !== undefined ? deadline : currentHomework[4], // Deadline
            currentHomework[5] // Created Date
        ];

        // Update the row
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Homework!A${rowIndex}:F${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [updatedRow]
            }
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Homework updated successfully',
                homework: {
                    id: updatedRow[0],
                    class: updatedRow[1],
                    subject: updatedRow[2],
                    description: updatedRow[3],
                    deadline: updatedRow[4],
                    createdDate: updatedRow[5]
                }
            })
        };

    } catch (error) {
        console.error('Error updating homework:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Internal server error: ' + error.message
            })
        };
    }
};
