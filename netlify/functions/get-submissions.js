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
            range: 'Submissions!A:F'
        });

        const submissionRows = submissionsResponse.data.values || [];
        let submissions = [];

        if (submissionRows.length > 1) {
            submissions = submissionRows.slice(1).map(row => ({
                id: row[0],
                homeworkId: row[1],
                studentId: row[2],
                fileName: row[3],
                fileUrl: row[4],
                submittedAt: row[5]
            }));
        }

        // Filter by homework ID if provided
        if (homeworkId) {
            submissions = submissions.filter(sub => sub.homeworkId === homeworkId);
        }

        // Get student names for submissions
        const studentsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Students!A:D'
        });

        const studentRows = studentsResponse.data.values || [];
        const studentsMap = {};

        if (studentRows.length > 1) {
            studentRows.slice(1).forEach(row => {
                studentsMap[row[0]] = {
                    class: row[1],
                    lastName: row[2],
                    firstName: row[3]
                };
            });
        }

        // Filter by class if provided
        if (classGroup) {
            submissions = submissions.filter(sub => {
                const student = studentsMap[sub.studentId];
                return student && student.class === classGroup;
            });
        }

        // Enrich submissions with student data
        const enrichedSubmissions = submissions.map(sub => ({
            ...sub,
            student: studentsMap[sub.studentId] || {
                class: 'Unknown',
                lastName: 'Unknown',
                firstName: 'Student'
            }
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                submissions: enrichedSubmissions,
                total: enrichedSubmissions.length
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
