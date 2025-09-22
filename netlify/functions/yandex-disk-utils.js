const https = require('https');

/**
 * Create a directory on Yandex.Disk
 * @param {string} dirPath - Directory path
 * @param {string} oauthToken - Yandex.Disk OAuth token
 * @returns {Promise<Object>} Result of the operation
 */
async function createDirectory(dirPath, oauthToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'cloud-api.yandex.net',
            port: 443,
            path: `/v1/disk/resources?path=${encodeURIComponent(dirPath)}`,
            method: 'PUT',
            headers: {
                'Authorization': `OAuth ${oauthToken}`,
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true });
                } else {
                    // Directory might already exist, which is fine
                    if (res.statusCode === 409) {
                        resolve({ success: true, alreadyExists: true });
                    } else {
                        try {
                            const responseData = JSON.parse(data);
                            reject(new Error(`Failed to create directory: ${responseData.message}`));
                        } catch (e) {
                            reject(new Error(`Failed to create directory: ${res.statusCode}`));
                        }
                    }
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

/**
 * Ensure all directories in a path exist
 * @param {string} filePath - Full path to file
 * @param {string} oauthToken - Yandex.Disk OAuth token
 * @returns {Promise<void>}
 */
async function createDirectoriesForPath(filePath, oauthToken) {
    // Extract the directory path from the file path
    const dirPath = filePath.split('/').slice(0, -1).join('/');
    if (!dirPath) return Promise.resolve();
    
    // Split path into segments and create each directory level
    const segments = dirPath.split('/').filter(s => s);
    let currentPath = '';
    
    for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        try {
            await createDirectory(currentPath, oauthToken);
        } catch (error) {
            // Ignore error if directory already exists
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }
    }
}

/**
 * Get URL for uploading a file to Yandex.Disk
 * @param {string} filePath - Path on Yandex.Disk where to save the file
 * @param {string} oauthToken - Yandex.Disk OAuth token
 * @returns {Promise<string>} Upload URL
 */
async function getUploadUrl(filePath, oauthToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'cloud-api.yandex.net',
            port: 443,
            path: `/v1/disk/resources/upload?path=${encodeURIComponent(filePath)}&overwrite=true`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const response = JSON.parse(data);
                        resolve(response.href);
                    } catch (e) {
                        reject(new Error('Invalid response format'));
                    }
                } else {
                    try {
                        const responseData = JSON.parse(data);
                        reject(new Error(`Failed to get upload URL: ${responseData.message}`));
                    } catch (e) {
                        reject(new Error(`Failed to get upload URL: ${res.statusCode}`));
                    }
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

/**
 * Upload file to URL obtained from getUploadUrl
 * @param {string} url - Upload URL
 * @param {Buffer} fileBuffer - File buffer
 * @returns {Promise<Object>} Result of the operation
 */
async function uploadToUrl(url, fileBuffer) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileBuffer.length
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true });
                } else {
                    reject(new Error(`Failed to upload file: ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(fileBuffer);
        req.end();
    });
}

/**
 * Get public URL for a file on Yandex.Disk
 * @param {string} filePath - Path to file on Yandex.Disk
 * @param {string} oauthToken - Yandex.Disk OAuth token
 * @returns {Promise<string>} Public URL
 */
async function getPublicUrl(filePath, oauthToken) {
    // First publish the file
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'cloud-api.yandex.net',
            port: 443,
            path: `/v1/disk/resources/publish?path=${encodeURIComponent(filePath)}`,
            method: 'PUT',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', async () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        // Now get the public URL
                        const metadataOptions = {
                            hostname: 'cloud-api.yandex.net',
                            port: 443,
                            path: `/v1/disk/resources?path=${encodeURIComponent(filePath)}`,
                            method: 'GET',
                            headers: {
                                'Authorization': `OAuth ${oauthToken}`
                            }
                        };
                        
                        const metadataReq = https.request(metadataOptions, (metadataRes) => {
                            let metadataData = '';
                            
                            metadataRes.on('data', (chunk) => {
                                metadataData += chunk;
                            });
                            
                            metadataRes.on('end', () => {
                                if (metadataRes.statusCode === 200) {
                                    try {
                                        const metadata = JSON.parse(metadataData);
                                        if (metadata.public_url) {
                                            resolve(metadata.public_url);
                                        } else {
                                            reject(new Error('Public URL not found'));
                                        }
                                    } catch (e) {
                                        reject(new Error('Invalid metadata response'));
                                    }
                                } else {
                                    reject(new Error(`Failed to get metadata: ${metadataRes.statusCode}`));
                                }
                            });
                        });
                        
                        metadataReq.on('error', (error) => {
                            reject(error);
                        });
                        
                        metadataReq.end();
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    try {
                        const responseData = JSON.parse(data);
                        reject(new Error(`Failed to publish file: ${responseData.message}`));
                    } catch (e) {
                        reject(new Error(`Failed to publish file: ${res.statusCode}`));
                    }
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

/**
 * Upload a file to Yandex.Disk
 * @param {Object} fileData - File data object with fileName, fileContent (base64), and fileType
 * @param {string} telegramId - User's Telegram ID
 * @param {string} classGroup - User's class/grade
 * @param {string} oauthToken - Yandex.Disk OAuth token
 * @returns {Promise<string>} Public URL to the uploaded file
 */
async function uploadFileToYandexDisk(fileData, telegramId, classGroup, oauthToken) {
    try {
        // Create file path
        const fileName = fileData.fileName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
        const filePath = `/Homework_App/Submissions/${classGroup}/${telegramId}/${Date.now()}_${fileName}`;
        
        // Ensure directories exist
        await createDirectoriesForPath(filePath, oauthToken);
        
        // Get upload URL
        const uploadUrl = await getUploadUrl(filePath, oauthToken);
        
        // Convert base64 to buffer
        const fileBuffer = Buffer.from(fileData.fileContent, 'base64');
        
        // Upload file
        await uploadToUrl(uploadUrl, fileBuffer);
        
        // Get public URL
        const publicUrl = await getPublicUrl(filePath, oauthToken);
        
        return publicUrl;
    } catch (error) {
        console.error('Error uploading file to Yandex.Disk:', error);
        throw error;
    }
}

module.exports = {
    createDirectory,
    createDirectoriesForPath,
    getUploadUrl,
    uploadToUrl,
    getPublicUrl,
    uploadFileToYandexDisk
};
