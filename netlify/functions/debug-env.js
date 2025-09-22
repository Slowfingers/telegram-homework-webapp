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

    try {
        const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        
        if (!serviceAccountJson) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'GOOGLE_SERVICE_ACCOUNT_JSON not set'
                })
            };
        }

        // Try to parse the JSON
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(serviceAccountJson);
        } catch (parseError) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Invalid JSON format',
                    error: parseError.message,
                    jsonLength: serviceAccountJson.length,
                    jsonStart: serviceAccountJson.substring(0, 100)
                })
            };
        }

        // Check required fields
        const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missingFields = requiredFields.filter(field => !serviceAccount[field]);

        if (missingFields.length > 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Missing required fields',
                    missingFields,
                    availableFields: Object.keys(serviceAccount)
                })
            };
        }

        // Check private key format
        const privateKey = serviceAccount.private_key;
        const fixedPrivateKey = privateKey.replace(/\\n/g, '\n');
        const hasBeginMarker = privateKey.includes('-----BEGIN PRIVATE KEY-----');
        const hasEndMarker = privateKey.includes('-----END PRIVATE KEY-----');
        const hasLiteralNewlines = privateKey.includes('\\n');
        const hasActualNewlines = fixedPrivateKey.includes('\n');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Service account JSON is valid',
                details: {
                    type: serviceAccount.type,
                    project_id: serviceAccount.project_id,
                    client_email: serviceAccount.client_email,
                    privateKeyLength: privateKey.length,
                    fixedPrivateKeyLength: fixedPrivateKey.length,
                    hasBeginMarker,
                    hasEndMarker,
                    hasLiteralNewlines,
                    hasActualNewlines,
                    privateKeyStart: privateKey.substring(0, 50),
                    privateKeyEnd: privateKey.substring(privateKey.length - 50),
                    fixedPrivateKeyStart: fixedPrivateKey.substring(0, 50)
                }
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Error checking environment',
                error: error.message
            })
        };
    }
};
