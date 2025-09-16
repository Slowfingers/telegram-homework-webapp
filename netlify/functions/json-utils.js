// Утилиты для работы с JSON файлами на Yandex Disk
const https = require('https');

// Helper function to download with redirect handling
function downloadWithRedirects(url, callback, maxRedirects = 5) {
    if (maxRedirects <= 0) {
        callback(new Error('Too many redirects'));
        return;
    }
    
    console.log('Downloading from URL:', url);
    
    https.get(url, (res) => {
        console.log('Response status:', res.statusCode);
        
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            console.log('Following redirect to:', res.headers.location);
            downloadWithRedirects(res.headers.location, callback, maxRedirects - 1);
            return;
        }
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Final download successful, content length:', data.length);
                callback(null, data);
            });
        } else {
            callback(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
    }).on('error', callback);
}

// Функция для чтения JSON файла с Yandex Disk
async function downloadJson(filePath, oauthToken) {
    return new Promise((resolve) => {
        console.log('=== DOWNLOADING JSON ===');
        console.log('File path:', filePath);
        
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
                console.log('Download URL request status:', res.statusCode);
                
                if (res.statusCode !== 200) {
                    console.log('Failed to get download URL:', data);
                    resolve('{}'); // Return empty JSON object
                    return;
                }
                
                try {
                    const response = JSON.parse(data);
                    console.log('Download href received:', response.href ? 'YES' : 'NO');
                    
                    if (response.href) {
                        console.log('Downloading JSON content from href...');
                        downloadWithRedirects(response.href, (error, fileData) => {
                            if (error) {
                                console.error('JSON download error:', error);
                                resolve('{}');
                            } else {
                                console.log('Downloaded bytes:', Buffer.byteLength(fileData, 'utf8'));
                                console.log('Downloaded content preview:', fileData.substring(0, 200));
                                resolve(fileData || '{}');
                            }
                        });
                    } else {
                        console.log('No download href in response');
                        resolve('{}');
                    }
                } catch (error) {
                    console.error('JSON parse error:', error);
                    resolve('{}');
                }
            });
        });

        req.on('error', (error) => {
            console.error('Download request error:', error);
            resolve('{}');
        });
        req.end();
    });
}

// Функция для загрузки JSON файла на Yandex Disk
async function uploadJson(filePath, jsonData, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('=== UPLOADING JSON ===');
        console.log('File path:', filePath);
        console.log('Data size:', JSON.stringify(jsonData).length, 'characters');
        
        // Get upload URL
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
                console.log('Upload URL request status:', res.statusCode);
                
                if (res.statusCode !== 200) {
                    console.error('Failed to get upload URL:', data);
                    reject(new Error(`Upload URL failed: ${res.statusCode}`));
                    return;
                }
                
                try {
                    const response = JSON.parse(data);
                    console.log('Upload href received:', response.href ? 'YES' : 'NO');
                    
                    if (response.href) {
                        // Upload JSON content
                        const urlObj = new URL(response.href);
                        const jsonString = JSON.stringify(jsonData, null, 2);
                        const buffer = Buffer.from(jsonString, 'utf8');
                        
                        console.log('Uploading JSON content, size:', buffer.length, 'bytes');
                        
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
                                    console.log('JSON upload successful');
                                    resolve();
                                } else {
                                    console.error('JSON upload failed:', uploadRes.statusCode, uploadData);
                                    reject(new Error(`Upload failed: ${uploadRes.statusCode}`));
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

// Функция для регистрации студента в JSON
async function registerStudentJson(studentData, oauthToken) {
    const filePath = "/Homework_App/Records/Students.json";
    
    try {
        console.log('=== REGISTERING STUDENT IN JSON ===');
        console.log('Student data:', studentData);
        
        // Download current JSON
        const jsonContent = await downloadJson(filePath, oauthToken);
        let studentsData;
        
        try {
            studentsData = JSON.parse(jsonContent);
            if (!studentsData.students) {
                studentsData = { students: [] };
            }
        } catch (error) {
            console.log('Creating new JSON structure');
            studentsData = { students: [] };
        }
        
        console.log('Current students count:', studentsData.students.length);
        
        // Check if student already exists
        const existingIndex = studentsData.students.findIndex(
            student => student.telegramId === studentData.telegramId
        );
        
        if (existingIndex >= 0) {
            // Update existing student
            console.log('Updating existing student at index:', existingIndex);
            studentsData.students[existingIndex] = {
                ...studentsData.students[existingIndex],
                ...studentData,
                lastUpdated: new Date().toISOString().split('T')[0]
            };
        } else {
            // Add new student
            console.log('Adding new student');
            studentsData.students.push({
                ...studentData,
                registrationDate: new Date().toISOString().split('T')[0]
            });
        }
        
        console.log('New students count:', studentsData.students.length);
        
        // Upload updated JSON
        await uploadJson(filePath, studentsData, oauthToken);
        
        return {
            success: true,
            student: studentData,
            isNewStudent: existingIndex < 0
        };
        
    } catch (error) {
        console.error('Register student JSON error:', error);
        throw error;
    }
}

// Функция для поиска пользователя в JSON
async function getUserJson(telegramId, oauthToken) {
    const filePath = "/Homework_App/Records/Students.json";
    
    try {
        console.log('=== GETTING USER FROM JSON ===');
        console.log('Looking for telegramId:', telegramId);
        
        // Download JSON
        const jsonContent = await downloadJson(filePath, oauthToken);
        let studentsData;
        
        try {
            studentsData = JSON.parse(jsonContent);
        } catch (error) {
            console.log('JSON parse error or empty file');
            return null;
        }
        
        if (!studentsData.students || !Array.isArray(studentsData.students)) {
            console.log('No students array found');
            return null;
        }
        
        console.log('Total students in JSON:', studentsData.students.length);
        
        // Find user by telegramId (convert both to string for comparison)
        const user = studentsData.students.find(
            student => String(student.telegramId) === String(telegramId)
        );
        
        if (user) {
            console.log('User found:', user);
            return user;
        } else {
            console.log('User not found');
            return null;
        }
        
    } catch (error) {
        console.error('Get user JSON error:', error);
        return null;
    }
}

// Verify file upload by checking metadata
async function verifyFileUpload(filePath, oauthToken) {
    return new Promise((resolve) => {
        console.log('=== VERIFYING FILE UPLOAD ===');
        console.log('Checking file:', filePath);
        
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
                console.log('Verify request status:', res.statusCode);
                
                if (res.statusCode === 200) {
                    try {
                        const metadata = JSON.parse(data);
                        console.log('File verification successful');
                        console.log('File size:', metadata.size);
                        console.log('File name:', metadata.name);
                        console.log('Modified:', metadata.modified);
                        
                        resolve({
                            success: true,
                            metadata: {
                                size: metadata.size,
                                name: metadata.name,
                                created: metadata.created,
                                modified: metadata.modified
                            }
                        });
                    } catch (error) {
                        console.error('Metadata parse error:', error);
                        resolve({ success: false, error: 'Metadata parse failed' });
                    }
                } else {
                    console.error('File verification failed:', res.statusCode);
                    resolve({ success: false, error: `Verification failed: ${res.statusCode}` });
                }
            });
        });

        req.on('error', (error) => {
            console.error('Verify request error:', error);
            resolve({ success: false, error: error.message });
        });
        req.end();
    });
}

module.exports = {
    downloadJson,
    uploadJson,
    registerStudentJson,
    getUserJson,
    verifyFileUpload
};
