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
        const filePath = "/Homework_App/Records/Students.csv";
        
        console.log('=== DIRECT CSV READ TEST ===');
        
        // Method 1: Try direct file read via resources API
        const directResult = await readFileDirectly(filePath, oauthToken);
        
        // Method 2: Try download URL method (current approach)
        const downloadResult = await readFileViaDownloadUrl(filePath, oauthToken);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                filePath: filePath,
                methods: {
                    direct: directResult,
                    downloadUrl: downloadResult
                }
            }, null, 2)
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

// Method 1: Direct file read
function readFileDirectly(filePath, oauthToken) {
    return new Promise((resolve) => {
        console.log('=== DIRECT READ METHOD ===');
        console.log('Reading file directly:', filePath);
        
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources?path=${encodeURIComponent(filePath)}`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Direct read status:', res.statusCode);
                console.log('Direct read response:', data);
                
                resolve({
                    method: 'direct',
                    statusCode: res.statusCode,
                    success: res.statusCode === 200,
                    response: data,
                    note: 'This method gets metadata, not file content'
                });
            });
        });

        req.on('error', (error) => {
            console.error('Direct read error:', error);
            resolve({
                method: 'direct',
                success: false,
                error: error.message
            });
        });
        req.end();
    });
}

// Method 2: Download URL method (current)
function readFileViaDownloadUrl(filePath, oauthToken) {
    return new Promise((resolve) => {
        console.log('=== DOWNLOAD URL METHOD ===');
        console.log('Getting download URL for:', filePath);
        
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources/download?path=${encodeURIComponent(filePath)}`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Download URL status:', res.statusCode);
                console.log('Download URL response:', data);
                
                if (res.statusCode !== 200) {
                    resolve({
                        method: 'downloadUrl',
                        step: 'getDownloadUrl',
                        statusCode: res.statusCode,
                        success: false,
                        response: data
                    });
                    return;
                }
                
                try {
                    const response = JSON.parse(data);
                    if (response.href) {
                        console.log('Got download href, downloading content...');
                        
                        // Download actual content
                        https.get(response.href, (fileRes) => {
                            let fileData = '';
                            fileRes.setEncoding('utf8');
                            fileRes.on('data', (chunk) => fileData += chunk);
                            fileRes.on('end', () => {
                                console.log('File download status:', fileRes.statusCode);
                                console.log('File content length:', fileData.length);
                                console.log('File content preview:', fileData.substring(0, 100));
                                
                                resolve({
                                    method: 'downloadUrl',
                                    step: 'downloadContent',
                                    downloadUrlStatus: res.statusCode,
                                    fileDownloadStatus: fileRes.statusCode,
                                    success: fileRes.statusCode >= 200 && fileRes.statusCode < 300,
                                    contentLength: fileData.length,
                                    contentPreview: fileData.substring(0, 100),
                                    isEmpty: fileData.length === 0,
                                    downloadHref: response.href
                                });
                            });
                        }).on('error', (error) => {
                            console.error('File download error:', error);
                            resolve({
                                method: 'downloadUrl',
                                step: 'downloadContent',
                                success: false,
                                error: error.message,
                                downloadHref: response.href
                            });
                        });
                    } else {
                        resolve({
                            method: 'downloadUrl',
                            step: 'getDownloadUrl',
                            success: false,
                            error: 'No href in response',
                            response: data
                        });
                    }
                } catch (error) {
                    resolve({
                        method: 'downloadUrl',
                        step: 'parseResponse',
                        success: false,
                        error: error.message,
                        response: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.error('Download URL request error:', error);
            resolve({
                method: 'downloadUrl',
                step: 'request',
                success: false,
                error: error.message
            });
        });
        req.end();
    });
}
