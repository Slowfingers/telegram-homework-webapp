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
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN || 'y0__xDpo-JiGJukOiDCr6CzFFRUktGhbaL_5rLrM8cKgh1409tx';
        
        console.log('Creating JSON file structure...');
        
        // Create initial JSON file with empty students array
        const initialData = {
            students: [],
            metadata: {
                created: new Date().toISOString(),
                version: "1.0",
                description: "Telegram Homework Bot - Students Database"
            }
        };
        
        try {
            await uploadInitialJson('/Homework_App/Records/Students.json', initialData, oauthToken);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'JSON structure created successfully',
                    filePath: '/Homework_App/Records/Students.json',
                    initialData: initialData
                })
            };
        } catch (error) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: error.message
                })
            };
        }
        
    } catch (error) {
        console.error('Create JSON structure failed:', error);
        
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

// Upload initial JSON file
function uploadInitialJson(filePath, jsonData, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('Creating initial JSON file:', filePath);
        
        // First get upload URL
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources/upload?path=${encodeURIComponent(filePath)}&overwrite=true`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Upload URL response status:', res.statusCode);
                
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to get upload URL: ${res.statusCode} - ${data}`));
                    return;
                }
                
                try {
                    const response = JSON.parse(data);
                    if (response.href) {
                        // Upload file content
                        const urlObj = new URL(response.href);
                        const jsonString = JSON.stringify(jsonData, null, 2);
                        const buffer = Buffer.from(jsonString, 'utf8');
                        
                        const uploadOptions = {
                            hostname: urlObj.hostname,
                            path: urlObj.pathname + urlObj.search,
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Content-Length': buffer.length
                            }
                        };

                        const uploadReq = https.request(uploadOptions, (uploadRes) => {
                            let uploadData = '';
                            uploadRes.on('data', (chunk) => uploadData += chunk);
                            uploadRes.on('end', () => {
                                console.log('JSON upload response status:', uploadRes.statusCode);
                                
                                if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
                                    resolve();
                                } else {
                                    reject(new Error(`JSON upload failed: ${uploadRes.statusCode} - ${uploadData}`));
                                }
                            });
                        });

                        uploadReq.on('error', reject);
                        uploadReq.write(buffer);
                        uploadReq.end();
                    } else {
                        reject(new Error('No upload href in response'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}
