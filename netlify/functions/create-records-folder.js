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
        
        console.log('Creating Records folder structure...');
        
        const results = [];
        
        // Create /Homework_App folder
        try {
            await createFolder('/Homework_App', oauthToken);
            results.push({ folder: '/Homework_App', status: 'created' });
        } catch (error) {
            if (error.message.includes('409')) {
                results.push({ folder: '/Homework_App', status: 'already_exists' });
            } else {
                results.push({ folder: '/Homework_App', status: 'error', error: error.message });
            }
        }
        
        // Create /Homework_App/Records folder
        try {
            await createFolder('/Homework_App/Records', oauthToken);
            results.push({ folder: '/Homework_App/Records', status: 'created' });
        } catch (error) {
            if (error.message.includes('409')) {
                results.push({ folder: '/Homework_App/Records', status: 'already_exists' });
            } else {
                results.push({ folder: '/Homework_App/Records', status: 'error', error: error.message });
            }
        }
        
        // Create initial CSV file with header
        try {
            const csvHeader = "telegramId,class,lastName,firstName,registrationDate\n";
            await uploadInitialCsv('/Homework_App/Records/Students.csv', csvHeader, oauthToken);
            results.push({ file: '/Homework_App/Records/Students.csv', status: 'created' });
        } catch (error) {
            results.push({ file: '/Homework_App/Records/Students.csv', status: 'error', error: error.message });
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Folder structure creation completed',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Create folders failed:', error);
        
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

// Create folder on Yandex Disk
function createFolder(folderPath, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('Creating folder:', folderPath);
        
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources?path=${encodeURIComponent(folderPath)}`,
            method: 'PUT',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Create folder response status:', res.statusCode);
                console.log('Create folder response body:', data);
                
                if (res.statusCode === 201) {
                    resolve();
                } else if (res.statusCode === 409) {
                    reject(new Error('Folder already exists (409)'));
                } else {
                    reject(new Error(`Create folder failed: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Upload initial CSV file
function uploadInitialCsv(filePath, csvContent, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('Creating initial CSV file:', filePath);
        
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
                        const buffer = Buffer.from(csvContent, 'utf8');
                        
                        const uploadOptions = {
                            hostname: urlObj.hostname,
                            path: urlObj.pathname + urlObj.search,
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'text/csv; charset=utf-8',
                                'Content-Length': buffer.length
                            }
                        };

                        const uploadReq = https.request(uploadOptions, (uploadRes) => {
                            let uploadData = '';
                            uploadRes.on('data', (chunk) => uploadData += chunk);
                            uploadRes.on('end', () => {
                                console.log('CSV upload response status:', uploadRes.statusCode);
                                
                                if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
                                    resolve();
                                } else {
                                    reject(new Error(`CSV upload failed: ${uploadRes.statusCode} - ${uploadData}`));
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
