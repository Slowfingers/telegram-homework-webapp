const { getGoogleSheetsClient, isAdmin } = require('./google-sheets-utils');

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }

    try {
        const { adminId, homeworkId, classGroup } = event.queryStringParameters || {};

        if (!adminId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'Missing adminId parameter' })
            };
        }

        // Check if user is admin or teacher
        if (!(await isAdmin(adminId))) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, message: 'Access denied. Admin or teacher role required.' })
            };
        }

        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // Get submissions
        const submissionsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Submissions!A:G'
        });

        const submissionRows = submissionsResponse.data.values || [];
        let submissions = [];

        if (submissionRows.length > 1) {
            submissions = submissionRows.slice(1).map(row => ({
                studentId: row[0],
                studentName: row[1],
                class: row[2],
                homeworkId: row[3],
                submittedAt: row[4],
                fileUrl: row[5],
                status: row[6] || 'Submitted'
            }));
        }

        // Filter by homework ID if provided
        if (homeworkId) {
            submissions = submissions.filter(sub => sub.homeworkId === homeworkId);
        }

        // Filter by class if provided
        if (classGroup) {
            submissions = submissions.filter(sub => sub.class === classGroup);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                submissions: submissions,
                total: submissions.length
            })
        };

    } catch (error) {
        console.error('Error getting submissions:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Internal server error'
            })
        };
    }
};
