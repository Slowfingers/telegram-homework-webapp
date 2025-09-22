const { getHomework } = require('./google-sheets-utils');

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Support both GET and POST for flexibility
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }

    try {
        let classGroup;

        // Extract class parameter based on HTTP method
        if (event.httpMethod === 'GET') {
            classGroup = event.queryStringParameters?.class;
        } else {
            const requestBody = JSON.parse(event.body);
            classGroup = requestBody.class;
        }

        // Validate required fields
        if (!classGroup) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'Missing class parameter' })
            };
        }

        // Get homework from Google Sheets
        console.log(`Getting homework for class: ${classGroup}`);
        const result = await getHomework(classGroup);

        if (result.success) {
            console.log(`Found ${result.homework.length} homework assignments for class ${classGroup}`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        } else {
            console.error(`Failed to get homework for class ${classGroup}:`, result.message);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, message: result.message || 'Failed to get homework' })
            };
        }
    } catch (error) {
        console.error('Error in get-homework:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'Internal server error' })
        };
    }
};
