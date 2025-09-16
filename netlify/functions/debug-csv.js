// Debug function to check CSV file content on Yandex Disk
const { readExcelFromYandexDisk, parseCSV } = require('./excel-utils');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('=== DEBUG CSV FUNCTION ===');
        
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        console.log('OAuth token exists:', !!oauthToken);
        console.log('OAuth token length:', oauthToken ? oauthToken.length : 0);
        
        if (!oauthToken) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'No OAuth token available',
                    debug: { hasToken: false }
                })
            };
        }

        const studentsFilePath = '/Домашки/Students.csv';
        
        try {
            console.log('Attempting to read CSV file:', studentsFilePath);
            const csvData = await readExcelFromYandexDisk(studentsFilePath, oauthToken);
            console.log('CSV file read successfully, length:', csvData.length);
            console.log('CSV content preview:', csvData.toString().substring(0, 500));
            
            const students = parseCSV(csvData);
            console.log('Parsed students count:', students.length);
            console.log('Students data:', students);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'CSV file read successfully',
                    data: {
                        fileExists: true,
                        fileSize: csvData.length,
                        studentsCount: students.length,
                        csvPreview: csvData.toString().substring(0, 500),
                        parsedStudents: students,
                        columns: students.length > 0 ? Object.keys(students[0]) : []
                    }
                })
            };
            
        } catch (fileError) {
            console.log('CSV file error:', fileError.message);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'CSV file not found or error reading',
                    error: fileError.message,
                    data: {
                        fileExists: false,
                        filePath: studentsFilePath
                    }
                })
            };
        }
        
    } catch (error) {
        console.error('Debug CSV error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    }
};
