const https = require('https');

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
        const { telegramId, class: userClass } = JSON.parse(event.body);
        
        console.log('=== GET ASSIGNMENTS ===');
        console.log('TelegramId:', telegramId);
        console.log('Class:', userClass);
        
        if (!telegramId || !userClass) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'TelegramId and class are required'
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

        // Загрузка заданий из /Homework_App/Homework.json
        const filePath = "/Homework_App/Homework.json";
        const assignments = await downloadAssignments(filePath, oauthToken);
        
        // Фильтрация по классу
        const classAssignments = assignments.filter(assignment => 
            assignment.class === userClass || assignment.class === 'all'
        );
        
        console.log('Found assignments for class:', classAssignments.length);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                assignments: classAssignments,
                debug: {
                    totalAssignments: assignments.length,
                    classAssignments: classAssignments.length,
                    filePath: filePath
                }
            })
        };
        
    } catch (error) {
        console.error('Get assignments error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to load assignments',
                error: error.message
            })
        };
    }
};

async function downloadAssignments(filePath, oauthToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources/download?path=${encodeURIComponent(filePath)}`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        console.log('Getting download URL for assignments...');

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    const downloadUrl = response.href;
                    
                    console.log('Download URL received, downloading assignments...');
                    
                    // Скачиваем файл
                    const downloadReq = https.get(downloadUrl, (downloadRes) => {
                        let fileData = '';
                        downloadRes.on('data', chunk => fileData += chunk);
                        downloadRes.on('end', () => {
                            try {
                                const assignments = JSON.parse(fileData);
                                console.log('Assignments downloaded successfully, count:', assignments.length);
                                resolve(assignments);
                            } catch (parseError) {
                                console.error('Failed to parse assignments JSON:', parseError);
                                resolve([]); // Возвращаем пустой массив если файл поврежден
                            }
                        });
                    });
                    
                    downloadReq.on('error', (error) => {
                        console.error('Download error:', error);
                        resolve([]); // Возвращаем пустой массив при ошибке
                    });
                    
                } else if (res.statusCode === 404) {
                    console.log('Assignments file not found, returning empty array');
                    resolve([]); // Файл не найден - возвращаем пустой массив
                } else {
                    console.error('Failed to get download URL:', res.statusCode, data);
                    resolve([]);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            resolve([]);
        });

        req.end();
    });
}
