// Telegram WebApp для домашних заданий
let tg;
let currentUser = null;
const API_BASE_URL = 'https://evrikaforhome.netlify.app/.netlify/functions';
const ADMIN_ID = 606360710;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initTelegramWebApp();
});

function initTelegramWebApp() {
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        
        console.log('Telegram WebApp initialized');
        checkUserRegistration();
    } else {
        console.log('Telegram WebApp not available, using mock mode');
        // Мок для тестирования
        tg = {
            initDataUnsafe: { user: { id: 123456789, first_name: 'Test', last_name: 'User' } },
            initData: 'mock_data'
        };
        checkUserRegistration();
    }
}

// Проверка регистрации пользователя
async function checkUserRegistration() {
    try {
        const telegramId = tg.initDataUnsafe?.user?.id;
        if (!telegramId) {
            showError('Ошибка получения данных Telegram');
            return;
        }

        console.log('Checking registration for user:', telegramId);

        const response = await fetch(`${API_BASE_URL}/check-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: telegramId,
                initData: tg.initData
            })
        });

        const data = await response.json();
        console.log('Check user response:', data);

        if (data.success && data.user) {
            currentUser = data.user;
            showScreen('mainScreen');
            updateUserInfo();
        } else {
            showScreen('registrationScreen');
        }
    } catch (error) {
        console.error('Error checking user:', error);
        showScreen('registrationScreen');
    }
}

// Регистрация пользователя
async function handleRegistration(event) {
    event.preventDefault();
    
    const userClass = document.getElementById('userClass').value;
    const lastName = document.getElementById('lastName').value.trim();
    const firstName = document.getElementById('firstName').value.trim();
    
    if (!userClass || !lastName || !firstName) {
        showMessage('Заполните все поля', 'error');
        return;
    }

    const telegramId = tg.initDataUnsafe?.user?.id;
    const userData = {
        telegramId,
        class: userClass,
        lastName,
        firstName,
        registrationDate: new Date().toISOString().split('T')[0]
    };

    try {
        const response = await fetch(`${API_BASE_URL}/register-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId,
                initData: tg.initData,
                userData
            })
        });

        const data = await response.json();
        
        if (data.success) {
            currentUser = userData;
            showMessage('Регистрация успешна!', 'success');
            setTimeout(() => {
                showScreen('mainScreen');
                updateUserInfo();
            }, 1500);
        } else {
            showMessage(data.message || 'Ошибка регистрации', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Ошибка подключения к серверу', 'error');
    }
}

// Загрузка заданий
async function loadAssignments() {
    try {
        const response = await fetch(`${API_BASE_URL}/get-assignments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: currentUser.telegramId,
                class: currentUser.class
            })
        });

        const data = await response.json();
        
        if (data.success) {
            displayAssignments(data.assignments);
        } else {
            showMessage('Ошибка загрузки заданий', 'error');
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
        showMessage('Ошибка подключения к серверу', 'error');
    }
}

// Отображение заданий
function displayAssignments(assignments) {
    const container = document.getElementById('assignmentsList');
    
    if (!assignments || assignments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">Заданий пока нет</p>';
        return;
    }

    container.innerHTML = assignments.map(assignment => `
        <div class="assignment-card">
            <div class="assignment-date">${formatDate(assignment.deadline)}</div>
            <div class="assignment-topic">${assignment.topic}</div>
            <div class="assignment-description">${assignment.description}</div>
            <div class="assignment-class">Класс: ${assignment.class}</div>
        </div>
    `).join('');
}

// Отправка домашки
async function handleSubmission(event) {
    event.preventDefault();
    
    const topic = document.getElementById('assignmentTopic').value.trim();
    const fileInput = document.getElementById('fileInput');
    
    if (!topic) {
        showMessage('Укажите тему задания', 'error');
        return;
    }
    
    if (!fileInput.files.length) {
        showMessage('Выберите файл для отправки', 'error');
        return;
    }

    const file = fileInput.files[0];
    
    // Проверка размера файла (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showMessage('Размер файла не должен превышать 10MB', 'error');
        return;
    }

    try {
        const fileContent = await fileToBase64(file);
        
        const response = await fetch(`${API_BASE_URL}/submit-homework`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: currentUser.telegramId,
                initData: tg.initData,
                submissionData: {
                    class: currentUser.class,
                    lastName: currentUser.lastName,
                    firstName: currentUser.firstName,
                    topic: topic,
                    fileName: file.name,
                    fileContent: fileContent,
                    fileSize: file.size,
                    submissionDate: new Date().toISOString()
                }
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showMessage('Домашка успешно отправлена!', 'success');
            document.getElementById('submissionForm').reset();
            updateFileUploadUI();
        } else {
            showMessage(data.message || 'Ошибка отправки', 'error');
        }
    } catch (error) {
        console.error('Submission error:', error);
        showMessage('Ошибка подключения к серверу', 'error');
    }
}

// Админ функции
async function handleAddAssignment(event) {
    event.preventDefault();
    
    const assignmentClass = document.getElementById('assignmentClassAdmin').value;
    const topic = document.getElementById('assignmentTopicAdmin').value.trim();
    const description = document.getElementById('assignmentDescription').value.trim();
    const deadline = document.getElementById('assignmentDeadline').value;
    
    if (!assignmentClass || !topic || !description || !deadline) {
        showMessage('Заполните все поля', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/add-assignment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: currentUser.telegramId,
                initData: tg.initData,
                assignmentData: {
                    class: assignmentClass,
                    topic,
                    description,
                    deadline,
                    createdDate: new Date().toISOString().split('T')[0]
                }
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showMessage('Задание успешно добавлено!', 'success');
            document.getElementById('addAssignmentForm').reset();
        } else {
            showMessage(data.message || 'Ошибка добавления задания', 'error');
        }
    } catch (error) {
        console.error('Add assignment error:', error);
        showMessage('Ошибка подключения к серверу', 'error');
    }
}

// Утилиты
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        
        // Специальная логика для экранов
        if (screenId === 'assignmentsScreen') {
            loadAssignments();
        } else if (screenId === 'mainScreen') {
            updateUserInfo();
        }
    }
}

function updateUserInfo() {
    if (!currentUser) return;
    
    const userName = document.getElementById('userName');
    const userClass = document.getElementById('userClass');
    const adminBtn = document.getElementById('adminBtn');
    
    if (userName) {
        userName.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    }
    
    if (userClass) {
        userClass.textContent = `Класс: ${currentUser.class}`;
    }
    
    // Показать админ кнопку для админа
    if (adminBtn && currentUser.telegramId == ADMIN_ID) {
        adminBtn.style.display = 'block';
    }
}

function showMessage(message, type) {
    // Простое уведомление
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        padding: 12px 20px; border-radius: 8px; z-index: 1000;
        background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
        color: ${type === 'success' ? '#155724' : '#721c24'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function showError(message) {
    showMessage(message, 'error');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

function updateFileUploadUI() {
    const fileInput = document.getElementById('fileInput');
    const uploadText = document.getElementById('fileUploadText');
    
    if (fileInput && uploadText) {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            uploadText.innerHTML = `📎 ${file.name}<br><small>${(file.size / 1024).toFixed(1)} KB</small>`;
            fileInput.parentElement.classList.add('has-file');
        } else {
            uploadText.innerHTML = '📎 Нажмите для выбора файла<br><small>PDF, DOC, TXT, код и другие</small>';
            fileInput.parentElement.classList.remove('has-file');
        }
    }
}

function showAdminSection(sectionId) {
    document.querySelectorAll('#adminScreen > div[id$="Section"]').forEach(section => {
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(sectionId + 'Section');
    if (targetSection) {
        targetSection.style.display = 'block';
        
        if (sectionId === 'viewSubmissions') {
            loadSubmissions();
        }
    }
}

async function loadSubmissions() {
    try {
        const response = await fetch(`${API_BASE_URL}/get-submissions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: currentUser.telegramId,
                initData: tg.initData
            })
        });

        const data = await response.json();
        
        if (data.success) {
            displaySubmissions(data.submissions);
        } else {
            showMessage('Ошибка загрузки журнала', 'error');
        }
    } catch (error) {
        console.error('Error loading submissions:', error);
        showMessage('Ошибка подключения к серверу', 'error');
    }
}

function displaySubmissions(submissions) {
    const container = document.getElementById('submissionsList');
    
    if (!submissions || submissions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">Сдач пока нет</p>';
        return;
    }

    container.innerHTML = submissions.map(submission => `
        <div class="submission-item">
            <strong>${submission.firstName} ${submission.lastName}</strong> (${submission.class})
            <div class="submission-meta">
                ${submission.topic} • ${submission.fileName} • ${formatDate(submission.submissionDate)}
            </div>
        </div>
    `).join('');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Регистрация
    const regForm = document.getElementById('registrationForm');
    if (regForm) {
        regForm.addEventListener('submit', handleRegistration);
    }
    
    // Отправка домашки
    const subForm = document.getElementById('submissionForm');
    if (subForm) {
        subForm.addEventListener('submit', handleSubmission);
    }
    
    // Добавление задания (админ)
    const addForm = document.getElementById('addAssignmentForm');
    if (addForm) {
        addForm.addEventListener('submit', handleAddAssignment);
    }
    
    // Файл инпут
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', updateFileUploadUI);
    }
});
