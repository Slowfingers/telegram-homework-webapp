// Утилиты для работы с Excel файлами на Yandex Disk
const https = require('https');

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

// Download CSV content from Yandex Disk
async function downloadCsv(filePath, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('Downloading CSV from:', filePath);
        
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
                console.log('Download URL response status:', res.statusCode);
                
                if (res.statusCode === 404) {
                    console.log('File not found, returning empty content');
                    resolve('');
                    return;
                }
                
                if (res.statusCode !== 200) {
                    console.log('Download URL error:', data);
                    resolve('');
                    return;
                }
                
                try {
                    const response = JSON.parse(data);
                    if (response.href) {
                        // Download actual file content
                        https.get(response.href, (fileRes) => {
                            let fileData = '';
                            fileRes.on('data', (chunk) => fileData += chunk);
                            fileRes.on('end', () => {
                                console.log('File downloaded successfully, size:', fileData.length);
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

// Upload CSV content to Yandex Disk
async function uploadCsv(filePath, csvContent, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('Uploading CSV to:', filePath);
        console.log('CSV content length:', csvContent.length);
        
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
                    console.error('Failed to get upload URL:', data);
                    reject(new Error(`Upload URL error: ${res.statusCode}`));
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
                                'Content-Type': 'text/csv',
                                'Content-Length': buffer.length
                            }
                        };

                        const uploadReq = https.request(uploadOptions, (uploadRes) => {
                            let uploadData = '';
                            uploadRes.on('data', (chunk) => uploadData += chunk);
                            uploadRes.on('end', () => {
                                console.log('Upload response status:', uploadRes.statusCode);
                                if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
                                    console.log('CSV uploaded successfully');
                                    resolve();
                                } else {
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

// Register student using the improved CSV approach
async function registerStudent(student, oauthToken) {
    const filePath = "/Homework_App/Records/Students.csv";
    
    console.log('Registering student:', student);
    
    try {
        // 1. Download existing CSV content
        let content = await downloadCsv(filePath, oauthToken);
        
        // 2. If empty, create with header
        if (!content) {
            content = "telegramId,class,lastName,firstName,registrationDate\n";
        }
        
        // 3. Parse rows
        let rows = content.trim().split("\n");
        let headers = rows.shift(); // first row
        let exists = false;
        
        rows = rows.map(r => {
            if (!r.trim()) return r; // skip empty rows
            
            let [tid, cl, ln, fn, date] = r.split(",");
            if (tid === String(student.telegramId)) {
                exists = true;
                return `${student.telegramId},${student.class},${student.lastName},${student.firstName},${student.registrationDate}`;
            }
            return r;
        });
        
        if (!exists) {
            rows.push(`${student.telegramId},${student.class},${student.lastName},${student.firstName},${student.registrationDate}`);
        }
        
        // 4. Build new CSV
        let newCsv = headers + "\n" + rows.filter(r => r.trim()).join("\n");
        
        // 5. Upload to Yandex Disk
        await uploadCsv(filePath, newCsv, oauthToken);
        
        console.log('Student registered successfully');
        return true;
        
    } catch (error) {
        console.error('Student registration error:', error);
        throw error;
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
    registerStudent
};
