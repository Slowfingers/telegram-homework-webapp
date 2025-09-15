const crypto = require('crypto');

// Telegram Bot Token (set in Netlify environment variables)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Yandex API credentials (set in Netlify environment variables)
const YANDEX_OAUTH_TOKEN = process.env.YANDEX_OAUTH_TOKEN;

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }

    try {
        const { class: userClass, type, initData } = JSON.parse(event.body);

        // Validate required fields
        if (!userClass || !type) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'Missing required fields' })
            };
        }

        // Validate Telegram data
        if (!validateTelegramData(initData)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid Telegram data' })
            };
        }

        // Get assignments from Yandex Tables
        const assignments = await getAssignmentsFromDatabase(userClass, type);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                assignments: assignments
            })
        };

    } catch (error) {
        console.error('Error in get-assignments:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'Internal server error' })
        };
    }
};

// Validate Telegram WebApp data
function validateTelegramData(initData) {
    if (!initData || !BOT_TOKEN) {
        return false;
    }

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        // Check hash
        if (calculatedHash !== hash) {
            return false;
        }

        // Check auth_date (data should not be older than 24 hours)
        const authDate = parseInt(urlParams.get('auth_date'));
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime - authDate > 86400) { // 24 hours
            return false;
        }

        return true;
    } catch (error) {
        console.error('Telegram validation error:', error);
        return false;
    }
}

// Get assignments from Yandex Disk
async function getAssignmentsFromDatabase(userClass, type = 'current') {
    try {
        // Get assignments folder for the class
        const folderPath = `/Homework_App/assignments/${userClass}`;
        
        const response = await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(folderPath)}&fields=_embedded.items.name,_embedded.items.file,_embedded.items.modified`, {
            headers: {
                'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
            }
        });

        let assignments = [];

        if (response.ok) {
            const data = await response.json();
            
            // Process each assignment file
            if (data._embedded && data._embedded.items) {
                for (const item of data._embedded.items) {
                    if (item.name.startsWith('assignment_') && item.name.endsWith('.json')) {
                        try {
                            // Download and parse assignment file
                            const fileResponse = await fetch(item.file, {
                                headers: {
                                    'Authorization': `OAuth ${YANDEX_OAUTH_TOKEN}`
                                }
                            });
                            
                            if (fileResponse.ok) {
                                const assignmentData = await fileResponse.json();
                                assignments.push(assignmentData);
                            }
                        } catch (error) {
                            console.error('Error loading assignment file:', error);
                        }
                    }
                }
            }
        }

        // If no assignments found, return mock data for demo
        if (assignments.length === 0) {
            assignments = [
                {
                    id: '1',
                    date: '2024-09-16',
                    class: userClass,
                    topic: 'Алгоритмы сортировки',
                    description: 'Изучить алгоритмы пузырьковой сортировки и быстрой сортировки. Написать программу на Python.',
                    materialLink: 'https://example.com/sorting-algorithms',
                    createdAt: new Date().toISOString()
                },
                {
                    id: '2',
                    date: '2024-09-18',
                    class: userClass,
                    topic: 'Структуры данных',
                    description: 'Реализовать стек и очередь на Python. Решить задачи на использование этих структур.',
                    materialLink: '',
                    createdAt: new Date().toISOString()
                }
            ];
        }

        // Filter by type (current/archived)
        const currentDate = new Date();
        const filteredAssignments = assignments.filter(assignment => {
            const assignmentDate = new Date(assignment.date);
            if (type === 'current') {
                return assignmentDate >= currentDate;
            } else {
                return assignmentDate < currentDate;
            }
        });

        // Sort by date (newest first)
        filteredAssignments.sort((a, b) => new Date(b.date) - new Date(a.date));

        return filteredAssignments;
    } catch (error) {
        console.error('Database error:', error);
        // Return mock data on error
        return [
            {
                id: '1',
                date: '2024-09-16',
                class: userClass,
                topic: 'Алгоритмы сортировки',
                description: 'Изучить алгоритмы пузырьковой сортировки и быстрой сортировки. Написать программу на Python.',
                materialLink: 'https://example.com/sorting-algorithms',
                createdAt: new Date().toISOString()
            }
        ];
    }
}
