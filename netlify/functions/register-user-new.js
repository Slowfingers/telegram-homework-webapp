const { registerStudent } = require('./excel-utils');

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
        const { telegramId, initData, userData } = JSON.parse(event.body);
        
        console.log('=== REGISTER USER NEW ===');
        console.log('TelegramId:', telegramId);
        console.log('UserData:', userData);
        
        if (!telegramId || !userData) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'TelegramId and userData are required'
                })
            };
        }

        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        if (!oauthToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'OAuth token not configured'
                })
            };
        }

        // Подготовка данных студента
        const student = {
            telegramId: userData.telegramId,
            class: userData.class,
            lastName: userData.lastName,
            firstName: userData.firstName,
            registrationDate: userData.registrationDate || new Date().toISOString().split('T')[0]
        };

        // Регистрация в /Homework_App/Students.csv
        const filePath = "/Homework_App/Students.csv";
        await registerStudent(student, oauthToken, filePath);
        
        console.log('User registered successfully');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'User registered successfully',
                user: student,
                debug: {
                    method: 'csv_registration',
                    filePath: filePath
                }
            })
        };
        
    } catch (error) {
        console.error('Register user error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Registration failed',
                error: error.message
            })
        };
    }
};
