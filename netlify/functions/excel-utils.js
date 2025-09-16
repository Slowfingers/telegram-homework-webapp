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
function uploadExcelToYandexDisk(filePath, fileBuffer, oauthToken) {
    return new Promise((resolve, reject) => {
        console.log('Starting upload to Yandex Disk:', filePath);
        console.log('File buffer size:', fileBuffer.length);
        console.log('OAuth token length:', oauthToken ? oauthToken.length : 'no token');
        
        // Сначала получаем ссылку для загрузки
        getUploadUrl(filePath, oauthToken, true) // overwrite = true
            .then(uploadUrl => {
                console.log('Got upload URL:', uploadUrl);
                return uploadFileToUrl(uploadUrl, fileBuffer);
            })
            .then(result => {
                console.log('File uploaded successfully to:', filePath);
                console.log('Upload result:', result);
                resolve(result);
            })
            .catch(error => {
                console.error('Upload error for file:', filePath);
                console.error('Error details:', error.message);
                console.error('Error stack:', error.stack);
                reject(error);
            });
    });
}

// Функция для загрузки файла по прямой ссылке
function uploadFileToUrl(url, fileBuffer) {
    return new Promise((resolve, reject) => {
        console.log('Uploading file to URL:', url);
        console.log('File buffer size:', fileBuffer.length);
        
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

        console.log('Upload options:', options);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log('Upload response status:', res.statusCode);
                console.log('Upload response data:', data);
                
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('File upload successful');
                    resolve(data);
                } else {
                    console.error('Upload failed with status:', res.statusCode);
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
    console.log('Creating CSV for students:', students.length);
    console.log('Students data:', students);
    
    const headers = 'ID,Telegram ID,Класс,Фамилия,Имя,Дата регистрации\n';
    const rows = students.map((student, index) => {
        const row = `${index + 1},${student.telegramId},"${student.class}","${student.lastName}","${student.firstName}","${student.registrationDate || new Date().toISOString().split('T')[0]}"`;
        console.log('Creating row:', row);
        return row;
    }).join('\n');
    
    const csvContent = headers + rows;
    console.log('Final CSV content:', csvContent);
    
    return Buffer.from(csvContent, 'utf-8');
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

module.exports = {
    readExcelFromYandexDisk,
    uploadExcelToYandexDisk,
    createStudentsExcel,
    createHomeworkTrackingExcel,
    parseCSV,
    getUploadUrl,
    uploadFileToUrl
};
