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

    console.log('=== TEST SIMPLE FUNCTION ===');
    console.log('Method:', event.httpMethod);
    console.log('Body:', event.body);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: 'Test function works!',
            timestamp: new Date().toISOString(),
            method: event.httpMethod,
            receivedBody: event.body
        })
    };
};
