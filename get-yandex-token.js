#!/usr/bin/env node

/**
 * Скрипт для получения Yandex OAuth токена
 * Использование: node get-yandex-token.js [authorization_code]
 */

const https = require('https');
const querystring = require('querystring');

const CLIENT_ID = '79cc733111fa4473b5c68c93eb8b1887';
const CLIENT_SECRET = '6885a7f18d7e4f5d8ff74bc20f48d0af';
const REDIRECT_URI = 'https://oauth.yandex.ru/verification_code';

function getAuthorizationUrl() {
    const params = {
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'cloud_api:disk.read cloud_api:disk.write cloud_api:disk.info'
    };
    
    return `https://oauth.yandex.ru/authorize?${querystring.stringify(params)}`;
}

function exchangeCodeForToken(code) {
    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        });

        const options = {
            hostname: 'oauth.yandex.ru',
            port: 443,
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
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
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

async function main() {
    const args = process.argv.slice(2);
    const authCode = args[0];

    if (!authCode) {
        console.log('🔐 Получение Yandex OAuth токена');
        console.log('=====================================\n');
        
        console.log('1. Перейдите по ссылке для авторизации:');
        console.log(`   ${getAuthorizationUrl()}\n`);
        
        console.log('2. Авторизуйтесь в Yandex и скопируйте код подтверждения\n');
        
        console.log('3. Запустите скрипт с полученным кодом:');
        console.log(`   node get-yandex-token.js YOUR_AUTHORIZATION_CODE\n`);
        
        return;
    }

    try {
        console.log('🔄 Обмениваем код на токен...\n');
        
        const tokenResponse = await exchangeCodeForToken(authCode);
        
        if (tokenResponse.access_token) {
            console.log('✅ Токен успешно получен!');
            console.log('============================\n');
            
            console.log('📋 Добавьте эту переменную в настройки Netlify:');
            console.log(`YANDEX_OAUTH_TOKEN=${tokenResponse.access_token}\n`);
            
            console.log('📝 Дополнительная информация:');
            console.log(`- Тип токена: ${tokenResponse.token_type}`);
            console.log(`- Срок действия: ${tokenResponse.expires_in} секунд`);
            if (tokenResponse.refresh_token) {
                console.log(`- Refresh токен: ${tokenResponse.refresh_token}`);
            }
            console.log(`- Права доступа: ${tokenResponse.scope}\n`);
            
        } else {
            console.error('❌ Ошибка получения токена:');
            console.error(JSON.stringify(tokenResponse, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

main();
