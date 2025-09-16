const { registerStudent, downloadCsv, getUser } = require('./excel-utils');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN || 'y0__xDpo-JiGJukOiDCr6CzFFRUktGhbaL_5rLrM8cKgh1409tx';
        
        console.log('Testing new CSV approach...');
        console.log('OAuth token available:', !!oauthToken);
        
        // Test student data
        const testStudent = {
            telegramId: 123456789,
            class: '10',
            lastName: 'Тестов',
            firstName: 'Тест',
            registrationDate: new Date().toISOString().split('T')[0]
        };
        
        console.log('Test student:', testStudent);
        
        // Step 1: Try to register student
        console.log('Step 1: Registering test student...');
        await registerStudent(testStudent, oauthToken);
        console.log('Student registered successfully');
        
        // Step 2: Try to read back the CSV
        console.log('Step 2: Reading back CSV content...');
        const filePath = "/Homework_App/Records/Students.csv";
        const content = await downloadCsv(filePath, oauthToken);
        
        console.log('CSV content length:', content ? content.length : 0);
        console.log('CSV content preview:', content ? content.substring(0, 200) : 'Empty');
        
        // Step 3: Use getUser function to find our student
        console.log('Step 3: Using getUser function to find student...');
        const foundStudent = await getUser(testStudent.telegramId, oauthToken);
        
        console.log('Found student:', foundStudent);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'CSV approach test completed',
                results: {
                    registrationSuccess: true,
                    csvContentLength: content ? content.length : 0,
                    csvPreview: content ? content.substring(0, 200) : 'Empty',
                    totalRows: content ? content.trim().split("\n").length : 0,
                    studentFound: !!foundStudent,
                    foundStudentData: foundStudent,
                    testStudent: testStudent
                }
            })
        };
        
    } catch (error) {
        console.error('Test failed:', error);
        
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
