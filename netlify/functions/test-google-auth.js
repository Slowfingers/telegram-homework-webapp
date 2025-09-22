const { google } = require('googleapis');

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
        const spreadsheetId = process.env.SPREADSHEET_ID;
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY;
        
        // Check if we have either JSON format or separate variables
        const hasJsonFormat = serviceAccountJson && spreadsheetId;
        const hasSeparateFormat = clientEmail && privateKey && spreadsheetId;
        
        if (!hasJsonFormat && !hasSeparateFormat) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Required environment variables not set',
                    hasServiceAccount: !!serviceAccountJson,
                    hasSpreadsheetId: !!spreadsheetId,
                    hasClientEmail: !!clientEmail,
                    hasPrivateKey: !!privateKey,
                    hasJsonFormat,
                    hasSeparateFormat
                })
            };
        }

        let serviceAccount;
        
        if (clientEmail && privateKey) {
            // Use separate environment variables
            // Fix private key format - replace literal \n with actual newlines
            const fixedPrivateKey = privateKey.replace(/\\n/g, '\n');
            
            serviceAccount = {
                type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE || 'service_account',
                project_id: process.env.GOOGLE_PROJECT_ID,
                private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
                private_key: fixedPrivateKey,
                client_email: clientEmail,
                client_id: process.env.GOOGLE_CLIENT_ID,
                auth_uri: 'https://accounts.google.com/o/oauth2/auth',
                token_uri: 'https://oauth2.googleapis.com/token',
                auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
                client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
                universe_domain: 'googleapis.com'
            };
        } else {
            // Fallback to JSON format
            try {
                serviceAccount = JSON.parse(serviceAccountJson);
                // Fix private key format - replace literal \n with actual newlines
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            } catch (parseError) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: 'Failed to parse service account JSON',
                        error: parseError.message
                    })
                };
            }
        }
        
        let jwtClient;
        try {
            jwtClient = new google.auth.JWT(
                serviceAccount.client_email,
                null,
                serviceAccount.private_key,
                ['https://www.googleapis.com/auth/spreadsheets']
            );
        } catch (jwtError) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Failed to create JWT client',
                    error: jwtError.message,
                    clientEmail: serviceAccount.client_email,
                    privateKeyLength: serviceAccount.private_key.length,
                    privateKeyStart: serviceAccount.private_key.substring(0, 100),
                    privateKeyHasBegin: serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----'),
                    privateKeyHasEnd: serviceAccount.private_key.includes('-----END PRIVATE KEY-----')
                })
            };
        }

        // Try to authorize
        try {
            await jwtClient.authorize();
        } catch (authError) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Failed to authorize JWT client',
                    error: authError.message,
                    errorCode: authError.code,
                    errorDetails: authError.details,
                    clientEmail: serviceAccount.client_email,
                    projectId: serviceAccount.project_id,
                    privateKeyLength: serviceAccount.private_key.length,
                    privateKeyStart: serviceAccount.private_key.substring(0, 50),
                    privateKeyEnd: serviceAccount.private_key.substring(serviceAccount.private_key.length - 50)
                })
            };
        }

        // Try to create sheets client
        let sheets;
        try {
            sheets = google.sheets({ version: 'v4', auth: jwtClient });
        } catch (sheetsError) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Failed to create sheets client',
                    error: sheetsError.message
                })
            };
        }

        // Try to access the spreadsheet
        try {
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId,
                includeGridData: false
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Google Sheets authentication successful',
                    spreadsheetTitle: spreadsheet.data.properties.title,
                    sheetsCount: spreadsheet.data.sheets.length,
                    existingSheets: spreadsheet.data.sheets.map(sheet => sheet.properties.title)
                })
            };
        } catch (accessError) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Failed to access spreadsheet',
                    error: accessError.message,
                    errorCode: accessError.code,
                    spreadsheetId: spreadsheetId
                })
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Unexpected error',
                error: error.message,
                stack: error.stack
            })
        };
    }
};
