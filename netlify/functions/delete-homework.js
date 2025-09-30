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
        const { homeworkId, adminId } = JSON.parse(event.body);

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

        // Delete the row by clearing it and shifting rows up
        // First, get all rows after the one to delete
        const totalRows = rows.length;
        if (rowIndex < totalRows) {
            // Get rows after the one to delete
            const remainingRows = rows.slice(rowIndex); // rowIndex is 1-indexed, so this gets rows after
            
            // Update the sheet with remaining rows
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `Homework!A${rowIndex}:F${totalRows}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: remainingRows
                }
            });
            
            // Clear the last row(s) since we shifted everything up
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: `Homework!A${totalRows}:F${totalRows}`
            });
        } else {
            // If it's the last row, just clear it
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: `Homework!A${rowIndex}:F${rowIndex}`
            });
        }

        // Also delete related submissions (optional, depends on your requirements)
        try {
            const submissionsResponse = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Submissions!A:G'
            });

            const submissionRows = submissionsResponse.data.values || [];
            const rowsToKeep = [submissionRows[0]]; // Keep header
            
            // Filter out submissions for this homework
            for (let i = 1; i < submissionRows.length; i++) {
                if (submissionRows[i][3] !== homeworkId) { // Column D is homework ID
                    rowsToKeep.push(submissionRows[i]);
                }
            }

            // Update submissions sheet
            if (rowsToKeep.length < submissionRows.length) {
                await sheets.spreadsheets.values.clear({
                    spreadsheetId,
                    range: 'Submissions!A:G'
                });
                
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: 'Submissions!A1',
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: rowsToKeep
                    }
                });
            }
        } catch (submissionError) {
            console.error('Error deleting related submissions:', submissionError);
            // Continue anyway, homework is deleted
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Homework deleted successfully'
            })
        };

    } catch (error) {
        console.error('Error deleting homework:', error);
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
