// Test function to register a user and verify CSV functionality
const crypto = require('crypto');
const { readExcelFromYandexDisk, uploadExcelToYandexDisk, createStudentsExcel, parseCSV } = require('./excel-utils');

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
        console.log('=== TEST REGISTER FUNCTION ===');
        
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        console.log('OAuth token exists:', !!oauthToken);
        
        if (!oauthToken) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'No OAuth token available'
                })
            };
        }

        // Test user data
        const testUser = {
            telegramId: 606360710,
            class: "6А",
            lastName: "TestUser",
            firstName: "Test",
            registrationDate: new Date().toISOString().split('T')[0]
        };

        console.log('Registering test user:', testUser);

        const studentsFilePath = '/Домашки/Students.csv';
        let students = [];
        
        try {
            // Try to read existing file
            console.log('Attempting to read existing CSV...');
            const existingData = await readExcelFromYandexDisk(studentsFilePath, oauthToken);
            console.log('Existing CSV read, length:', existingData.length);
            
            if (existingData.length > 0) {
                students = parseCSV(existingData);
                console.log('Parsed existing students:', students.length);
            }
        } catch (error) {
            console.log('No existing CSV file or error reading:', error.message);
        }

        // Check if user already exists
        const existingUser = students.find(s => 
            (s['Telegram ID'] && s['Telegram ID'].toString() === testUser.telegramId.toString()) ||
            (s['telegramId'] && s['telegramId'].toString() === testUser.telegramId.toString())
        );

        if (existingUser) {
            console.log('User already exists:', existingUser);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'User already registered',
                    user: existingUser,
                    studentsCount: students.length
                })
            };
        }

        // Add new user
        students.push({
            'Telegram ID': testUser.telegramId,
            'Класс': testUser.class,
            'Фамилия': testUser.lastName,
            'Имя': testUser.firstName,
            'Дата регистрации': testUser.registrationDate
        });

        console.log('Creating CSV with students:', students.length);

        // Create CSV content
        const csvHeader = 'Telegram ID,Класс,Фамилия,Имя,Дата регистрации\n';
        const csvRows = students.map(s => 
            `${s['Telegram ID'] || s.telegramId},${s['Класс'] || s.class},${s['Фамилия'] || s.lastName},${s['Имя'] || s.firstName},${s['Дата регистрации'] || s.registrationDate}`
        ).join('\n');
        
        const csvContent = csvHeader + csvRows;
        console.log('CSV content created:', csvContent);

        // Upload to Yandex Disk
        await uploadExcelToYandexDisk(studentsFilePath, Buffer.from(csvContent, 'utf8'), oauthToken);
        console.log('CSV uploaded successfully');

        // Verify by reading back
        const verifyData = await readExcelFromYandexDisk(studentsFilePath, oauthToken);
        const verifyStudents = parseCSV(verifyData);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Test user registered successfully',
                user: testUser,
                studentsCount: verifyStudents.length,
                csvContent: verifyData.toString(),
                parsedStudents: verifyStudents
            })
        };

    } catch (error) {
        console.error('Test register error:', error);
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
