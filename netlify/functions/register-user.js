const { registerStudentJson } = require('./json-utils');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  try {
    const oauthToken = process.env.YANDEX_OAUTH_TOKEN;
    if (!oauthToken) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Server not configured' }) };
    }

    const payload = JSON.parse(event.body || '{}');
    const { userData } = payload;

    if (!userData || !userData.telegramId || !userData.class || !userData.lastName || !userData.firstName) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Missing user fields' }) };
    }

    const student = {
      telegramId: userData.telegramId,
      class: userData.class,
      lastName: userData.lastName,
      firstName: userData.firstName,
      registrationDate: new Date().toISOString().split('T')[0]
    };

    await registerStudentJson(student, oauthToken);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'User registered successfully (JSON)',
        user: userData,
        debug: { method: 'json_approach', filePath: '/Homework_App/Records/Students.json' }
      })
    };
  } catch (error) {
    console.error('register-user error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message }) };
  }
};
