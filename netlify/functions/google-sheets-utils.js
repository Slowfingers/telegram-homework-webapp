const { google } = require('googleapis');

/**
 * Initialize Google Sheets API client with service account credentials
 * @returns {Object} Authenticated Google Sheets API client
 */
async function getGoogleSheetsClient() {
    try {
        // Try to use separate environment variables first
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY;
        
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
            serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
            // Fix private key format - replace literal \n with actual newlines
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        
        // Try using GoogleAuth.fromJSON instead of JWT directly
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        const jwtClient = await auth.getClient();
        
        // Authorize the JWT client
        await jwtClient.authorize();
        
        // Create and return Google Sheets API client
        const sheets = google.sheets({ version: 'v4', auth: jwtClient });
        return sheets;
    } catch (error) {
        console.error('Error initializing Google Sheets client:', error);
        throw new Error('Failed to initialize Google Sheets client');
    }
}

/**
 * Get spreadsheet ID from environment variables
 * @returns {string} Spreadsheet ID
 */
function getSpreadsheetId() {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
        throw new Error('SPREADSHEET_ID environment variable not set');
    }
    return spreadsheetId;
}

/**
 * Register or update a student in the Students sheet
 * @param {string} telegramId - Student's Telegram ID
 * @param {string} classGroup - Student's class/grade
 * @param {string} lastName - Student's last name
 * @param {string} firstName - Student's first name
 * @returns {Object} Result of the operation
 */
async function registerStudent(telegramId, classGroup, lastName, firstName) {
    try {
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        
        // First check if student exists
        const existingStudent = await getUser(telegramId);
        
        if (existingStudent) {
            // Update existing student
            const range = `Students!A${existingStudent.rowIndex}:D${existingStudent.rowIndex}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[telegramId, classGroup, lastName, firstName]]
                }
            });
            
            return {
                success: true,
                message: 'Student updated successfully',
                isNew: false,
                student: { telegramId, class: classGroup, lastName, firstName }
            };
        } else {
            // Get all students to determine next row
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Students!A:D'
            });
            
            const rows = response.data.values || [];
            const nextRow = rows.length + 1;
            
            // Add new student
            const range = `Students!A${nextRow}:D${nextRow}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[telegramId, classGroup, lastName, firstName]]
                }
            });
            
            return {
                success: true,
                message: 'Student registered successfully',
                isNew: true,
                student: { telegramId, class: classGroup, lastName, firstName }
            };
        }
    } catch (error) {
        console.error('Error registering student:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get teacher data from Teachers sheet by Telegram ID
 * @param {string} telegramId - Teacher's Telegram ID
 * @returns {Object|null} Teacher data or null if not found
 */
async function getTeacher(telegramId) {
    try {
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        
        // Check if Teachers sheet exists
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Teachers!A:F'
            });
            
            const rows = response.data.values || [];
            
            // Find teacher by Telegram ID
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[0] == telegramId) { // Use loose equality to handle string/number comparison
                    return {
                        telegramId: row[0],
                        lastName: row[1],
                        firstName: row[2],
                        subject: row[3],
                        classes: row[4] ? row[4].split(',').map(c => c.trim()) : [],
                        role: row[5] || 'teacher',
                        rowIndex: i + 1,
                        isTeacher: true
                    };
                }
            }
            
            return null; // Teacher not found
        } catch (err) {
            console.log('Teachers sheet may not exist yet:', err.message);
            return null;
        }
    } catch (error) {
        console.error('Error getting teacher:', error);
        throw error;
    }
}

/**
 * Check if a user is an admin
 * @param {string} telegramId - User's Telegram ID
 * @returns {boolean} True if user is an admin
 */
async function isAdmin(telegramId) {
    // Check admin ID
    const TELEGRAM_ADMIN_ID = '330977942'; // TODO: Замените на ваш реальный Telegram ID
    
    if (telegramId == TELEGRAM_ADMIN_ID) {
        return true;
    }
    
    // Also check Teachers with role=admin
    const teacher = await getTeacher(telegramId);
    return teacher && teacher.role === 'admin';
}

/**
 * Get user data from Students sheet by Telegram ID
 * @param {string} telegramId - Student's Telegram ID
 * @returns {Object|null} Student data or null if not found
 */
async function getUser(telegramId) {
    try {
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        
        // First check if user is a teacher
        const teacher = await getTeacher(telegramId);
        if (teacher) {
            return teacher; // Return teacher data if found
        }
        
        // Get all students
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Students!A:D'
        });
        
        const rows = response.data.values || [];
        
        // Find student by Telegram ID
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[0] == telegramId) { // Use loose equality to handle string/number comparison
                return {
                    telegramId: row[0],
                    class: row[1],
                    lastName: row[2],
                    firstName: row[3],
                    rowIndex: i + 1, // Adding 1 because arrays are 0-indexed but sheets are 1-indexed
                    isStudent: true
                };
            }
        }
        
        return null; // User not found
    } catch (error) {
        console.error('Error getting user:', error);
        throw error;
    }
}

/**
 * Add a new homework assignment to the Homework sheet
 * @param {string} adminId - ID of the user adding homework (must be teacher or admin)
 * @param {string} classGroup - Class/grade
 * @param {string} subject - Subject
 * @param {string} description - Description of the homework
 * @param {string} deadline - Deadline (YYYY-MM-DD format)
 * @returns {Object} Result of the operation with homework ID
 */
async function addHomework(adminId, classGroup, subject, description, deadline) {
    try {
        // Check if user has permissions (admin or teacher)
        const isUserAdmin = await isAdmin(adminId);
        const teacher = await getTeacher(adminId);
        
        // Check if teacher can add homework for this class
        const hasPermission = isUserAdmin || 
            (teacher && (teacher.classes.includes(classGroup) || teacher.classes.includes('all')));
        
        if (!hasPermission) {
            return {
                success: false,
                message: 'У вас нет прав для добавления домашнего задания для этого класса'
            };
        }
        
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        
        // Get existing homework to determine the next ID
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Homework!A:F' // Updated to include createdDate
        });
        
        const rows = response.data.values || [];
        
        // Generate a new ID (use timestamp if no rows yet)
        const nextId = rows.length > 1 
            ? (parseInt(rows[rows.length - 1][0]) + 1).toString()
            : Date.now().toString();
            
        const nextRow = rows.length + 1;
        const createdDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Add new homework
        const range = `Homework!A${nextRow}:F${nextRow}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[nextId, classGroup, subject, description, deadline, createdDate]]
            }
        });
        
        return {
            success: true,
            message: 'Домашнее задание успешно добавлено',
            homeworkId: nextId,
            homework: {
                id: nextId,
                class: classGroup,
                subject,
                description,
                deadline,
                createdDate
            }
        };
    } catch (error) {
        console.error('Error adding homework:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get homework assignments for a specific class
 * @param {string} classGroup - Class/grade
 * @returns {Array} Array of homework assignments
 */
async function getHomework(classGroup) {
    try {
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        
        // Get all homework
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Homework!A:F'
        });
        
        const rows = response.data.values || [];
        const headers = rows[0] || ['id', 'class', 'subject', 'description', 'deadline', 'createdDate'];
        
        // Filter homework by class
        const homework = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[1] === classGroup) {
                const homeworkItem = {
                    id: row[0],
                    class: row[1],
                    subject: row[2],
                    description: row[3],
                    deadline: row[4],
                    createdDate: row[5]
                };
                homework.push(homeworkItem);
            }
        }
        
        return {
            success: true,
            homework
        };
    } catch (error) {
        console.error('Error getting homework:', error);
        return { success: false, message: error.message, homework: [] };
    }
}

/**
 * Submit homework and record the submission
 * @param {string} telegramId - Student's Telegram ID
 * @param {string} homeworkId - Homework ID
 * @param {string} fileUrl - URL to the submitted file
 * @returns {Object} Result of the operation
 */
async function submitHomework(telegramId, homeworkId, fileUrl) {
    try {
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        
        // Get user info
        const user = await getUser(telegramId);
        if (!user) {
            return { success: false, message: 'Student not found' };
        }
        
        // Get homework info to confirm it exists
        const homeworkResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Homework!A:F'
        });
        
        const homeworkRows = homeworkResponse.data.values || [];
        let homeworkExists = false;
        let homeworkData = null;
        
        for (let i = 1; i < homeworkRows.length; i++) {
            if (homeworkRows[i][0] === homeworkId) {
                homeworkExists = true;
                homeworkData = {
                    id: homeworkRows[i][0],
                    class: homeworkRows[i][1],
                    subject: homeworkRows[i][2],
                    description: homeworkRows[i][3],
                    deadline: homeworkRows[i][4]
                };
                break;
            }
        }
        
        if (!homeworkExists) {
            return { success: false, message: 'Homework assignment not found' };
        }
        
        // Get existing submissions to determine next row
        const submissionsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Submissions!A:F'
        });
        
        const submissionRows = submissionsResponse.data.values || [];
        const nextRow = submissionRows.length + 1;
        const submissionDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Add submission
        const range = `Submissions!A${nextRow}:F${nextRow}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[telegramId, user.class, homeworkId, submissionDate, fileUrl, 'Submitted']]
            }
        });
        
        return {
            success: true,
            message: 'Homework submitted successfully',
            submission: {
                telegramId,
                class: user.class,
                homeworkId,
                submissionDate,
                fileUrl,
                status: 'Submitted'
            }
        };
    } catch (error) {
        console.error('Error submitting homework:', error);
        return { success: false, message: error.message };
    }
}

module.exports = {
    getGoogleSheetsClient,
    getSpreadsheetId,
    registerStudent,
    getUser,
    getTeacher,
    isAdmin,
    addHomework,
    getHomework,
    submitHomework
};
