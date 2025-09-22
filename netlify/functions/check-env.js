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

    // Check all required environment variables
    const envVars = {
        TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
        GOOGLE_SERVICE_ACCOUNT_JSON: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
        SPREADSHEET_ID: !!process.env.SPREADSHEET_ID,
        YANDEX_DISK_TOKEN: !!process.env.YANDEX_DISK_TOKEN
    };

    // Count how many are set
    const setCount = Object.values(envVars).filter(Boolean).length;
    const totalCount = Object.keys(envVars).length;

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: `${setCount}/${totalCount} environment variables are set`,
            variables: envVars,
            allSet: setCount === totalCount
        })
    };
};
