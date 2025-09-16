const { downloadCsv, uploadCsv, registerStudent, getUser, verifyFileUpload } = require('./excel-utils');

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
        const filePath = "/Homework_App/Records/Students.csv";
        
        console.log('=== DETAILED CSV DEBUG START ===');
        console.log('OAuth token available:', !!oauthToken);
        console.log('File path:', filePath);
        
        const results = {
            step1_download: null,
            step2_register: null,
            step3_verify: null,
            step4_redownload: null,
            step5_getuser: null
        };
        
        // Step 1: Try to download existing CSV
        console.log('\n=== STEP 1: DOWNLOAD EXISTING CSV ===');
        try {
            const existingContent = await downloadCsv(filePath, oauthToken);
            results.step1_download = {
                success: true,
                contentLength: existingContent ? existingContent.length : 0,
                contentPreview: existingContent ? existingContent.substring(0, 100) : 'EMPTY',
                isEmpty: !existingContent || existingContent.trim().length === 0
            };
            console.log('Step 1 result:', results.step1_download);
        } catch (error) {
            results.step1_download = { success: false, error: error.message };
            console.log('Step 1 error:', error);
        }
        
        // Step 2: Register a test student
        console.log('\n=== STEP 2: REGISTER TEST STUDENT ===');
        const testStudent = {
            telegramId: 999888777,
            class: '10',
            lastName: 'Тестовый',
            firstName: 'Пользователь',
            registrationDate: new Date().toISOString().split('T')[0]
        };
        
        try {
            await registerStudent(testStudent, oauthToken);
            results.step2_register = { success: true, student: testStudent };
            console.log('Step 2 result: SUCCESS');
        } catch (error) {
            results.step2_register = { success: false, error: error.message };
            console.log('Step 2 error:', error);
        }
        
        // Step 3: Verify file exists and has content
        console.log('\n=== STEP 3: VERIFY FILE METADATA ===');
        try {
            const metadata = await verifyFileUpload(filePath, oauthToken);
            results.step3_verify = { success: true, metadata };
            console.log('Step 3 result:', results.step3_verify);
        } catch (error) {
            results.step3_verify = { success: false, error: error.message };
            console.log('Step 3 error:', error);
        }
        
        // Step 4: Re-download CSV to see if it has content
        console.log('\n=== STEP 4: RE-DOWNLOAD CSV ===');
        try {
            const newContent = await downloadCsv(filePath, oauthToken);
            results.step4_redownload = {
                success: true,
                contentLength: newContent ? newContent.length : 0,
                contentPreview: newContent ? newContent.substring(0, 200) : 'EMPTY',
                fullContent: newContent,
                isEmpty: !newContent || newContent.trim().length === 0
            };
            console.log('Step 4 result:', {
                contentLength: results.step4_redownload.contentLength,
                isEmpty: results.step4_redownload.isEmpty,
                preview: results.step4_redownload.contentPreview
            });
        } catch (error) {
            results.step4_redownload = { success: false, error: error.message };
            console.log('Step 4 error:', error);
        }
        
        // Step 5: Try to get the user we just registered
        console.log('\n=== STEP 5: GET USER ===');
        try {
            const foundUser = await getUser(testStudent.telegramId, oauthToken);
            results.step5_getuser = {
                success: true,
                userFound: !!foundUser,
                user: foundUser
            };
            console.log('Step 5 result:', results.step5_getuser);
        } catch (error) {
            results.step5_getuser = { success: false, error: error.message };
            console.log('Step 5 error:', error);
        }
        
        console.log('=== DETAILED CSV DEBUG END ===');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Detailed CSV debug completed',
                filePath: filePath,
                testStudent: testStudent,
                results: results,
                summary: {
                    downloadWorked: results.step1_download?.success,
                    registerWorked: results.step2_register?.success,
                    verifyWorked: results.step3_verify?.success,
                    redownloadWorked: results.step4_redownload?.success,
                    getUserWorked: results.step5_getuser?.success,
                    finalFileSize: results.step3_verify?.metadata?.size || 0,
                    userFoundAfterRegistration: results.step5_getuser?.userFound
                }
            }, null, 2)
        };
        
    } catch (error) {
        console.error('Debug failed:', error);
        
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
