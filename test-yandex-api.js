#!/usr/bin/env node

/**
 * Тестирование Yandex Disk API
 * Проверяет подключение и создает необходимую структуру папок
 */

const https = require('https');

const YANDEX_OAUTH_TOKEN = 'y0__xDpo-JiGJukOiDCr6CzFFRUktGhbaL_5rLrM8cKgh1409tx';

function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'cloud-api.yandex.net',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = responseData ? JSON.parse(responseData) : {};
                    resolve({ status: res.statusCode, data: response });
                } catch (error) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function checkDiskInfo() {
    console.log('📊 Проверяем информацию о диске...');
    
    try {
        const response = await makeRequest('/v1/disk');
        
        if (response.status === 200) {
            console.log('✅ Подключение к Yandex Disk успешно!');
            console.log(`   Общий объем: ${Math.round(response.data.total_space / 1024 / 1024 / 1024)} ГБ`);
            console.log(`   Использовано: ${Math.round(response.data.used_space / 1024 / 1024 / 1024)} ГБ`);
            console.log(`   Свободно: ${Math.round((response.data.total_space - response.data.used_space) / 1024 / 1024 / 1024)} ГБ\n`);
            return true;
        } else {
            console.log('❌ Ошибка подключения к Yandex Disk');
            console.log(`   Статус: ${response.status}`);
            console.log(`   Ответ: ${JSON.stringify(response.data, null, 2)}\n`);
            return false;
        }
    } catch (error) {
        console.log('❌ Ошибка:', error.message);
        return false;
    }
}

async function createDirectory(path) {
    console.log(`📁 Создаем папку: ${path}`);
    
    try {
        const response = await makeRequest(`/v1/disk/resources?path=${encodeURIComponent(path)}`, 'PUT');
        
        if (response.status === 201) {
            console.log(`   ✅ Папка создана: ${path}`);
            return true;
        } else if (response.status === 409) {
            console.log(`   ℹ️  Папка уже существует: ${path}`);
            return true;
        } else {
            console.log(`   ❌ Ошибка создания папки: ${response.status}`);
            console.log(`   Ответ: ${JSON.stringify(response.data, null, 2)}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
        return false;
    }
}

async function listDirectory(path) {
    console.log(`📂 Содержимое папки: ${path}`);
    
    try {
        const response = await makeRequest(`/v1/disk/resources?path=${encodeURIComponent(path)}`);
        
        if (response.status === 200) {
            if (response.data._embedded && response.data._embedded.items) {
                const items = response.data._embedded.items;
                console.log(`   Найдено элементов: ${items.length}`);
                
                items.forEach(item => {
                    const type = item.type === 'dir' ? '📁' : '📄';
                    console.log(`   ${type} ${item.name}`);
                });
            } else {
                console.log('   Папка пуста');
            }
            return true;
        } else if (response.status === 404) {
            console.log('   ❌ Папка не найдена');
            return false;
        } else {
            console.log(`   ❌ Ошибка: ${response.status}`);
            console.log(`   Ответ: ${JSON.stringify(response.data, null, 2)}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
        return false;
    }
}

async function setupProjectStructure() {
    console.log('🏗️  Настраиваем структуру проекта...\n');
    
    const directories = [
        '/Homework_App',
        '/Homework_App/Submissions',
        '/Homework_App/Submissions/5А',
        '/Homework_App/Submissions/5Б',
        '/Homework_App/Submissions/6А',
        '/Homework_App/Submissions/6Б',
        '/Homework_App/Submissions/7А',
        '/Homework_App/Submissions/7Б',
        '/Homework_App/Submissions/8А',
        '/Homework_App/Submissions/8Б',
        '/Homework_App/Submissions/9А',
        '/Homework_App/Submissions/9Б',
        '/Homework_App/Submissions/10А',
        '/Homework_App/Submissions/10Б',
        '/Homework_App/Submissions/11А',
        '/Homework_App/Submissions/11Б',
        '/Homework_App/Records'
    ];
    
    for (const dir of directories) {
        await createDirectory(dir);
    }
    
    console.log('\n📋 Проверяем созданную структуру...\n');
    
    await listDirectory('/Homework_App');
    await listDirectory('/Homework_App/Submissions');
}

async function main() {
    console.log('🧪 Тестирование Yandex Disk API');
    console.log('================================\n');
    
    const connected = await checkDiskInfo();
    
    if (connected) {
        await setupProjectStructure();
        
        console.log('\n🎉 Настройка завершена!');
        console.log('Теперь можно развертывать приложение на Netlify с переменными:');
        console.log(`YANDEX_OAUTH_TOKEN=${YANDEX_OAUTH_TOKEN}`);
    }
}

main().catch(console.error);
