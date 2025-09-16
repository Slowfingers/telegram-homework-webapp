// Debug function to test Yandex Disk API step by step
const https = require('https');

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
        const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
        console.log('=== YANDEX DISK API DEBUG ===');
        console.log('OAuth token exists:', !!oauthToken);
        console.log('OAuth token length:', oauthToken ? oauthToken.length : 0);

        if (!oauthToken) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'No OAuth token available'
                })
            };
        }

        // Test 1: Check if folder exists
        console.log('Step 1: Checking if /Homework_App folder exists...');
        const folderCheck = await checkFolder('/Homework_App', oauthToken);
        console.log('Folder check result:', folderCheck);

        // Test 2: Try to get upload URL
        console.log('Step 2: Getting upload URL for CSV file...');
        const uploadUrl = await getUploadUrl('/Homework_App/Students.csv', oauthToken);
        console.log('Upload URL result:', uploadUrl);

        // Test 3: Try to upload simple CSV content
        if (uploadUrl.success && uploadUrl.href) {
            console.log('Step 3: Uploading test CSV content...');
            const testCsv = 'Telegram ID,Класс,Фамилия,Имя,Дата регистрации\n606360710,6А,TestUser,Test,2025-09-16';
            const uploadResult = await uploadToUrl(uploadUrl.href, Buffer.from(testCsv, 'utf8'));
            console.log('Upload result:', uploadResult);

            // Test 4: Try to read back the file
            console.log('Step 4: Reading back the uploaded file...');
            const readResult = await readFile('/Homework_App/Students.csv', oauthToken);
            console.log('Read result:', readResult);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Yandex Disk API debug completed',
                    steps: {
                        folderCheck: folderCheck,
                        uploadUrl: uploadUrl,
                        uploadResult: uploadResult,
                        readResult: readResult
                    }
                })
            };
        } else {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Failed to get upload URL',
                    steps: {
                        folderCheck: folderCheck,
                        uploadUrl: uploadUrl
                    }
                })
            };
        }

    } catch (error) {
        console.error('Debug error:', error);
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

// Helper functions
function checkFolder(path, oauthToken) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources?path=${encodeURIComponent(path)}`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    success: res.statusCode === 200,
                    statusCode: res.statusCode,
                    data: data
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });
        req.end();
    });
}

function getUploadUrl(path, oauthToken) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve({
                        success: res.statusCode === 200,
                        statusCode: res.statusCode,
                        href: response.href,
                        data: response
                    });
                } catch (error) {
                    resolve({
                        success: false,
                        statusCode: res.statusCode,
                        error: 'JSON parse error',
                        rawData: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });
        req.end();
    });
}

function uploadToUrl(url, buffer) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'PUT',
            headers: {
                'Content-Type': 'text/csv',
                'Content-Length': buffer.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    success: res.statusCode >= 200 && res.statusCode < 300,
                    statusCode: res.statusCode,
                    data: data
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });
        req.write(buffer);
        req.end();
    });
}

function readFile(path, oauthToken) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources/download?path=${encodeURIComponent(path)}`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.href) {
                        // Download the actual file content
                        downloadFromUrl(response.href).then(content => {
                            resolve({
                                success: true,
                                content: content,
                                size: content.length
                            });
                        }).catch(error => {
                            resolve({
                                success: false,
                                error: error.message
                            });
                        });
                    } else {
                        resolve({
                            success: false,
                            statusCode: res.statusCode,
                            data: response
                        });
                    }
                } catch (error) {
                    resolve({
                        success: false,
                        error: 'JSON parse error',
                        rawData: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });
        req.end();
    });
}

function downloadFromUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}
