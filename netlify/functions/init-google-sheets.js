const { google } = require('googleapis');

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Required environment variables not set. Need either GOOGLE_SERVICE_ACCOUNT_JSON or separate Google credentials.',
                    hasJsonFormat,
                    hasSeparateFormat,
                    hasSpreadsheetId: !!spreadsheetId
                })
            };
        }
        
        // Initialize Google Sheets client
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
            serviceAccount = JSON.parse(serviceAccountJson);
            // Fix private key format - replace literal \n with actual newlines
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        
        // Use GoogleAuth directly
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Get spreadsheet information
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
            includeGridData: false
        });
        
        // Check if required sheets exist
        const existingSheets = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
        const requiredSheets = ['Students', 'Homework', 'Submissions', 'Teachers'];
        const missingSheets = requiredSheets.filter(sheet => !existingSheets.includes(sheet));
        
        // Create missing sheets
        if (missingSheets.length > 0) {
            const requests = missingSheets.map(sheetTitle => {
                return {
                    addSheet: {
                        properties: {
                            title: sheetTitle
                        }
                    }
                };
            });
            
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests
                }
            });
        }
        
        // Initialize headers for each sheet if they don't exist
        const sheetsToInit = [
            {
                name: 'Students',
                headers: ['Telegram ID', 'Class', 'Last Name', 'First Name']
            },
            {
                name: 'Homework',
                headers: ['ID', 'Class', 'Subject', 'Description', 'Deadline', 'Created Date']
            },
            {
                name: 'Submissions',
                headers: ['Telegram ID', 'Student Name', 'Class', 'Homework ID', 'Submission Date', 'File URL', 'Status']
            },
            {
                name: 'Teachers',
                headers: ['Telegram ID', 'Last Name', 'First Name', 'Subject', 'Classes', 'Role']
            }
        ];
        
        for (const sheet of sheetsToInit) {
            const range = `${sheet.name}!A1:Z1`;
            
            // Check if headers already exist
            const headerResponse = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range
            });
            
            if (!headerResponse.data.values || headerResponse.data.values[0].length < sheet.headers.length) {
                // Set headers
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: [sheet.headers]
                    }
                });
            }
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'Google Sheets initialized successfully',
                spreadsheetId,
                sheets: existingSheets,
                missingSheets: missingSheets
            })
        };
    } catch (error) {
        console.error('Error initializing Google Sheets:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to initialize Google Sheets',
                error: error.message
            })
        };
    }
};
