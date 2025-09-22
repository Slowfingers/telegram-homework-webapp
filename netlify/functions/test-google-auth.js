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
        
        if (!serviceAccountJson || !spreadsheetId) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Required environment variables not set',
                    hasServiceAccount: !!serviceAccountJson,
                    hasSpreadsheetId: !!spreadsheetId
                })
            };
        }

        let serviceAccount;
        try {
            serviceAccount = JSON.parse(serviceAccountJson);
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

        // Fix private key format
        const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
        
        let jwtClient;
        try {
            jwtClient = new google.auth.JWT(
                serviceAccount.client_email,
                null,
                privateKey,
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
                    privateKeyLength: privateKey.length,
                    privateKeyStart: privateKey.substring(0, 100)
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
                    errorDetails: authError.details
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
