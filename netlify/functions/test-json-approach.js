const { registerStudentJson, getUserJson, verifyFileUpload } = require('./json-utils');

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
        const filePath = "/Homework_App/Records/Students.json";
        
        console.log('=== JSON APPROACH TEST ===');
        
        const testStudent = {
            telegramId: 888777666,
            class: "11",
            lastName: "Тестовый",
            firstName: "JSON",
            registrationDate: new Date().toISOString().split('T')[0]
        };
        
        const results = {
            step1_register: null,
            step2_verify: null,
            step3_getuser: null
        };
        
        // Step 1: Register test student
        try {
            console.log('Step 1: Registering test student...');
            const registerResult = await registerStudentJson(testStudent, oauthToken);
            results.step1_register = {
                success: true,
                result: registerResult
            };
            console.log('Registration successful:', registerResult);
        } catch (error) {
            results.step1_register = {
                success: false,
                error: error.message
            };
            console.error('Registration failed:', error);
        }
        
        // Step 2: Verify file upload
        try {
            console.log('Step 2: Verifying file upload...');
            const verifyResult = await verifyFileUpload(filePath, oauthToken);
            results.step2_verify = verifyResult;
            console.log('Verification result:', verifyResult);
        } catch (error) {
            results.step2_verify = {
                success: false,
                error: error.message
            };
            console.error('Verification failed:', error);
        }
        
        // Step 3: Get user back
        try {
            console.log('Step 3: Getting user back...');
            const user = await getUserJson(testStudent.telegramId, oauthToken);
            results.step3_getuser = {
                success: true,
                userFound: !!user,
                user: user
            };
            console.log('User lookup result:', user);
        } catch (error) {
            results.step3_getuser = {
                success: false,
                error: error.message
            };
            console.error('User lookup failed:', error);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'JSON approach test completed',
                filePath: filePath,
                testStudent: testStudent,
                results: results,
                summary: {
                    registerWorked: results.step1_register?.success || false,
                    verifyWorked: results.step2_verify?.success || false,
                    getUserWorked: results.step3_getuser?.success || false,
                    userFoundAfterRegistration: results.step3_getuser?.userFound || false,
                    finalFileSize: results.step2_verify?.metadata?.size || 0
                }
            }, null, 2)
        };
        
    } catch (error) {
        console.error('JSON test failed:', error);
        
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
