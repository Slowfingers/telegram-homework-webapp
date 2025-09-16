// Утилиты для работы с Excel файлами на Yandex Disk
const https = require('https');
const Papa = require('papaparse');

// Функция для чтения Excel файла с Yandex Disk
async function readExcelFromYandexDisk(filePath, oauthToken) {
    return new Promise((resolve, reject) => {
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
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.href) {
                        // Скачиваем файл по полученной ссылке
                        downloadFile(response.href).then(resolve).catch(reject);
                    } else {
                        reject(new Error('Не удалось получить ссылку для скачивания'));
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

// Функция для скачивания файла по прямой ссылке
function downloadFile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = Buffer.alloc(0);
            res.on('data', (chunk) => {
                data = Buffer.concat([data, chunk]);
            });
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', reject);
    });
}

// Функция для загрузки Excel файла на Yandex Disk
async function uploadExcelToYandexDisk(filePath, fileBuffer, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('Starting upload to Yandex Disk:', filePath);
        console.log('File buffer size:', fileBuffer.length);
        console.log('OAuth token length:', oauthToken ? oauthToken.length : 0);
        
        // Сначала получаем ссылку для загрузки
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
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log('Upload URL response status:', res.statusCode);
                console.log('Upload URL response data:', data);
                
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to get upload URL: ${res.statusCode} - ${data}`));
                    return;
                }
                
                try {
                    const response = JSON.parse(data);
                    if (response.href) {
                        console.log('Got upload URL, uploading file...');
                        // Загружаем файл по полученной ссылке
                        uploadFileToUrl(response.href, fileBuffer).then(() => {
                            console.log('File uploaded successfully');
                            resolve();
                        }).catch((error) => {
                            console.error('File upload failed:', error);
                            reject(error);
                        });
                    } else {
                        console.error('No href in response:', response);
                        reject(new Error('Не удалось получить ссылку для загрузки'));
                    }
                } catch (error) {
                    console.error('JSON parse error:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });
        req.end();
    });
}

// Функция для загрузки файла по прямой ссылке
function uploadFileToUrl(url, fileBuffer) {
    return new Promise((resolve, reject) => {
        console.log('Uploading to URL:', url);
        console.log('Buffer size:', fileBuffer.length);
        
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'PUT',
            headers: {
                'Content-Type': 'text/csv',
                'Content-Length': fileBuffer.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log('Upload response status:', res.statusCode);
                console.log('Upload response data:', data);
                
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`Ошибка загрузки: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            console.error('Upload request error:', error);
            reject(error);
        });
        req.write(fileBuffer);
        req.end();
    });
}

// Функция для создания простого Excel файла (CSV формат для совместимости)
function createStudentsExcel(students) {
    const headers = 'ID,Telegram ID,Класс,Фамилия,Имя,Дата регистрации\n';
    const rows = students.map((student, index) => 
        `${index + 1},${student.telegramId},"${student.class}","${student.lastName}","${student.firstName}","${student.registrationDate || new Date().toISOString().split('T')[0]}"`
    ).join('\n');
    
    return Buffer.from(headers + rows, 'utf-8');
}

// Функция для создания Excel файла отслеживания домашек
function createHomeworkTrackingExcel(assignments, students) {
    let content = 'Класс,Фамилия,Имя,Telegram ID';
    
    // Добавляем колонки для каждого задания
    assignments.forEach(assignment => {
        content += `,"${assignment.topic} (${assignment.date})"`;
    });
    content += '\n';
    
    // Добавляем строки для каждого студента
    students.forEach(student => {
        content += `${student.class},"${student.lastName}","${student.firstName}",${student.telegramId}`;
        
        // Добавляем статус для каждого задания (пустые ячейки для заполнения)
        assignments.forEach(() => {
            content += ','; // Пустая ячейка
        });
        content += '\n';
    });
    
    return Buffer.from(content, 'utf-8');
}

// Функция для парсинга CSV данных
function parseCSV(csvData) {
    const lines = csvData.toString().split('\n');
    if (lines.length === 0) return [];
    
    const headers = parseCSVLine(lines[0]);
    console.log('CSV Headers found:', headers);
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                const cleanHeader = header.trim().replace(/"/g, '');
                const cleanValue = values[index] ? values[index].trim().replace(/"/g, '') : '';
                row[cleanHeader] = cleanValue;
            });
            
            // Check if row has any ID field (more flexible check)
            const hasId = row['Telegram ID'] || row['telegramId'] || row['ID'] || 
                         Object.keys(row).some(key => key.toLowerCase().includes('telegram') || key.toLowerCase().includes('id'));
            
            if (Object.keys(row).length > 0 && hasId) {
                console.log('Adding row to data:', row);
                data.push(row);
            } else {
                console.log('Skipping row (no ID):', row);
            }
        }
    }
    
    console.log('Parsed CSV data:', data);
    return data;
}

// Функция для парсинга строки CSV с учетом кавычек
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// Download CSV content from Yandex Disk with detailed logging
async function downloadCsv(filePath, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('=== DOWNLOAD CSV DEBUG ===');
        console.log('FilePath:', filePath);
        console.log('OAuth token length:', oauthToken ? oauthToken.length : 0);
        
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources/download?path=${encodeURIComponent(filePath)}`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        console.log('Download URL request path:', options.path);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Download URL response status:', res.statusCode);
                console.log('Download URL response body:', data);
                
                if (res.statusCode === 404) {
                    console.log('File not found (404), returning empty content');
                    resolve('');
                    return;
                }
                
                if (res.statusCode !== 200) {
                    console.log('Download URL error, status:', res.statusCode, 'body:', data);
                    resolve('');
                    return;
                }
                
                try {
                    const response = JSON.parse(data);
                    console.log('Download href received:', response.href ? 'YES' : 'NO');
                    
                    if (response.href) {
                        console.log('Downloading file content from href...');
                        // Download actual file content
                        https.get(response.href, (fileRes) => {
                            let fileData = '';
                            fileRes.setEncoding('utf8'); // Ensure UTF-8 encoding
                            fileRes.on('data', (chunk) => fileData += chunk);
                            fileRes.on('end', () => {
                                console.log('File download status:', fileRes.statusCode);
                                console.log('Downloaded bytes:', Buffer.byteLength(fileData, 'utf8'));
                                console.log('Downloaded content preview:', fileData.substring(0, 100));
                                resolve(fileData);
                            });
                        }).on('error', (error) => {
                            console.error('File download error:', error);
                            resolve('');
                        });
                    } else {
                        console.log('No download href in response');
                        resolve('');
                    }
                } catch (error) {
                    console.error('JSON parse error:', error);
                    resolve('');
                }
            });
        });

        req.on('error', (error) => {
            console.error('Download request error:', error);
            resolve('');
        });
        req.end();
    });
}

// Upload CSV content to Yandex Disk with detailed logging and verification
async function uploadCsv(filePath, csvContent, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('=== UPLOAD CSV DEBUG ===');
        console.log('FilePath:', filePath);
        console.log('CSV content length:', csvContent.length);
        console.log('CSV content preview:', csvContent.substring(0, 100));
        
        // First get upload URL
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources/upload?path=${encodeURIComponent(filePath)}&overwrite=true`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        console.log('Upload URL request path:', options.path);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Upload URL response status:', res.statusCode);
                console.log('Upload URL response body:', data);
                
                if (res.statusCode !== 200) {
                    console.error('Failed to get upload URL, status:', res.statusCode, 'body:', data);
                    reject(new Error(`Upload URL error: ${res.statusCode}`));
                    return;
                }
                
                try {
                    const response = JSON.parse(data);
                    console.log('Upload href received:', response.href ? 'YES' : 'NO');
                    
                    if (response.href) {
                        // Upload file content
                        const urlObj = new URL(response.href);
                        const buffer = Buffer.from(csvContent, 'utf8');
                        
                        console.log('Buffer size for upload:', buffer.length);
                        console.log('Upload href:', response.href);
                        
                        const uploadOptions = {
                            hostname: urlObj.hostname,
                            path: urlObj.pathname + urlObj.search,
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'text/csv; charset=utf-8',
                                'Content-Length': buffer.length
                            }
                        };

                        console.log('Upload options:', uploadOptions);

                        const uploadReq = https.request(uploadOptions, (uploadRes) => {
                            let uploadData = '';
                            uploadRes.on('data', (chunk) => uploadData += chunk);
                            uploadRes.on('end', () => {
                                console.log('Upload response status:', uploadRes.statusCode);
                                console.log('Upload response body:', uploadData);
                                
                                if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
                                    console.log('CSV uploaded successfully, verifying...');
                                    
                                    // Verify upload by checking file metadata
                                    verifyFileUpload(filePath, oauthToken).then((verification) => {
                                        console.log('Upload verification:', verification);
                                        resolve();
                                    }).catch((verifyError) => {
                                        console.log('Verification failed but upload succeeded:', verifyError.message);
                                        resolve(); // Still resolve since upload succeeded
                                    });
                                } else {
                                    reject(new Error(`Upload failed: ${uploadRes.statusCode} - ${uploadData}`));
                                }
                            });
                        });

                        uploadReq.on('error', (error) => {
                            console.error('Upload request error:', error);
                            reject(error);
                        });
                        
                        console.log('Writing buffer to upload request...');
                        uploadReq.write(buffer);
                        uploadReq.end();
                    } else {
                        reject(new Error('No upload href in response'));
                    }
                } catch (error) {
                    console.error('Upload URL JSON parse error:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Upload URL request error:', error);
            reject(error);
        });
        req.end();
    });
}

// Verify file upload by checking metadata
async function verifyFileUpload(filePath, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('=== VERIFY UPLOAD ===');
        console.log('Verifying file:', filePath);
        
        const options = {
            hostname: 'cloud-api.yandex.net',
            path: `/v1/disk/resources?path=${encodeURIComponent(filePath)}&fields=size,name,created`,
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${oauthToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Verify response status:', res.statusCode);
                console.log('Verify response body:', data);
                
                if (res.statusCode === 200) {
                    try {
                        const metadata = JSON.parse(data);
                        console.log('File metadata:', {
                            name: metadata.name,
                            size: metadata.size,
                            created: metadata.created
                        });
                        
                        if (metadata.size === 0) {
                            reject(new Error('File uploaded but has zero size!'));
                        } else {
                            resolve(metadata);
                        }
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(new Error(`Verification failed: ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Register student using Papa.parse for proper CSV handling
async function registerStudent(student, oauthToken) {
    const filePath = "/Homework_App/Records/Students.csv";
    
    console.log('Registering student with Papa.parse:', student);
    
    try {
        // 1. Download existing CSV content
        let csvContent = await downloadCsv(filePath, oauthToken);
        
        // 2. If empty, create with header
        if (!csvContent) {
            csvContent = "telegramId,class,lastName,firstName,registrationDate\n";
        }
        
        console.log('Downloaded CSV content length:', csvContent.length);
        console.log('CSV preview:', csvContent.substring(0, 200));
        
        // 3. Parse with Papa.parse
        let parsed = Papa.parse(csvContent, { 
            header: true, 
            skipEmptyLines: true,
            transformHeader: (header) => header.trim()
        });
        let users = parsed.data.filter(u => u.telegramId && u.telegramId.trim());
        
        console.log('Parsed users count:', users.length);
        console.log('Existing users:', users);
        
        // 4. Check if user exists by telegramId
        const idx = users.findIndex(u => u.telegramId === String(student.telegramId));
        if (idx >= 0) {
            console.log('Updating existing user at index:', idx);
            users[idx] = student;
        } else {
            console.log('Adding new user');
            users.push(student);
        }
        
        console.log('Final users array:', users);
        
        // 5. Generate new CSV with Papa.unparse
        const newCsv = Papa.unparse(users);
        
        console.log('Generated CSV length:', newCsv.length);
        console.log('Generated CSV preview:', newCsv.substring(0, 200));
        
        // 6. Upload to Yandex Disk
        await uploadCsv(filePath, newCsv, oauthToken);
        
        console.log('Student registered successfully with Papa.parse');
        return student;
        
    } catch (error) {
        console.error('Student registration error:', error);
        throw error;
    }
}

// Get user by telegramId using Papa.parse
async function getUser(telegramId, oauthToken) {
    const filePath = "/Homework_App/Records/Students.csv";
    
    console.log('Getting user with Papa.parse, telegramId:', telegramId);
    
    try {
        let csvContent = await downloadCsv(filePath, oauthToken);
        
        if (!csvContent) {
            console.log('No CSV content found');
            return null;
        }
        
        console.log('Downloaded CSV for user lookup, length:', csvContent.length);
        
        let parsed = Papa.parse(csvContent, { 
            header: true, 
            skipEmptyLines: true,
            transformHeader: (header) => header.trim()
        });
        let users = parsed.data.filter(u => u.telegramId && u.telegramId.trim());
        
        console.log('Parsed users for lookup:', users.length);
        console.log('Looking for telegramId:', String(telegramId));
        
        const user = users.find(u => u.telegramId === String(telegramId));
        
        console.log('Found user:', user);
        
        return user || null;
        
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

module.exports = {
    readExcelFromYandexDisk,
    uploadExcelToYandexDisk,
    createStudentsExcel,
    createHomeworkTrackingExcel,
    parseCSV,
    downloadCsv,
    uploadCsv,
    registerStudent,
    getUser,
    verifyFileUpload
};
