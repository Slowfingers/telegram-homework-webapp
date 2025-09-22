// Global variables
let tg;
let currentUser = null;
let isInitialized = false;

const API_BASE_URL = '/.netlify/functions';

// Initialize the app
window.addEventListener('load', function() {
    if (isInitialized) return;
    
    showScreen('loadingScreen');
    
    // Try immediate initialization
    if (window.Telegram && window.Telegram.WebApp) {
        initializeApp();
        isInitialized = true;
    } else {
        // Fallback with delay
        setTimeout(() => {
            if (!isInitialized) {
                initializeApp();
                isInitialized = true;
            }
        }, 500);
    }
});

// Initialize Telegram WebApp
function initializeApp() {
    console.log('Initializing app...');
    
    // Initialize Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        console.log('Telegram WebApp initialized');
    } else {
        // Mock mode for testing
        tg = {
            initDataUnsafe: {
                user: { id: 123456789, first_name: 'Test', last_name: 'User' }
            },
            initData: 'mock_init_data',
            BackButton: {
                show: function() {},
                hide: function() {},
                isVisible: false
            },
            showAlert: function(message, callback) { 
                alert(message); 
                if (callback) callback();
            },
            close: function() {}
        };
        console.log('Running in mock mode');
    }
    
    setupEventListeners();
    checkUserRegistration();
}

// Setup event listeners
function setupEventListeners() {
    // Registration form
    const registrationForm = document.getElementById('registration-form');
    if (registrationForm) {
        registrationForm.addEventListener('submit', handleRegistration);
    }
    
    // Main menu buttons
    const checkHomeworkBtn = document.getElementById('check-homework-btn');
    if (checkHomeworkBtn) {
        checkHomeworkBtn.addEventListener('click', () => {
            showScreen('assignmentsScreen');
            loadAssignments();
        });
    }
    
    const submitHomeworkBtn = document.getElementById('submit-homework-btn');
    if (submitHomeworkBtn) {
        submitHomeworkBtn.addEventListener('click', () => {
            showScreen('submissionScreen');
            prefillSubmissionForm();
        });
    }
    
    // Admin button
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => showScreen('adminScreen'));
    }
    
    // Assignment tabs
    const currentTab = document.getElementById('current-tab');
    if (currentTab) {
        currentTab.addEventListener('click', () => switchAssignmentTab('current'));
    }
    
    const archivedTab = document.getElementById('archive-tab');
    if (archivedTab) {
        archivedTab.addEventListener('click', () => switchAssignmentTab('archived'));
    }
    
    // Back buttons
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(btn => {
        btn.addEventListener('click', () => showScreen('mainScreen'));
    });
    
    // Submit homework form
    const submitForm = document.getElementById('submit-form');
    if (submitForm) {
        submitForm.addEventListener('submit', handleHomeworkSubmission);
    }
    
    // Admin form
    const adminForm = document.getElementById('admin-form');
    if (adminForm) {
        adminForm.addEventListener('submit', handleAddAssignment);
    }
    
    // File upload
    setupFileUpload();
}

// Check if user is already registered
async function checkUserRegistration() {
    try {
        if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) {
            showError('Ошибка инициализации Telegram');
            return;
        }
        
        const telegramId = tg.initDataUnsafe.user.id;
        
        const response = await fetch(`${API_BASE_URL}/get-user?telegramId=${telegramId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.user) {
            // User is registered
            currentUser = data.user;
            console.log('User found:', currentUser);
            showMainScreen();
        } else {
            // User needs to register
            console.log('User not found, showing registration');
            showScreen('registrationScreen');
        }
    } catch (error) {
        console.log('Backend not available, showing registration');
        showScreen('registrationScreen');
    }
}

// Handle registration form submission
async function handleRegistration(e) {
    e.preventDefault();
    
    try {
        const classSelect = document.getElementById('class-select');
        const lastName = document.getElementById('last-name');
        const firstName = document.getElementById('first-name');
        
        if (!classSelect || !lastName || !firstName) {
            showModal('error', 'Форма регистрации не найдена');
            return;
        }
        
        const telegramId = tg.initDataUnsafe.user.id;
        const classValue = classSelect.value;
        const lastNameValue = lastName.value.trim();
        const firstNameValue = firstName.value.trim();
        
        if (!classValue || !lastNameValue || !firstNameValue) {
            showModal('error', 'Пожалуйста, заполните все поля');
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/register-student`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegramId: telegramId,
                class: classValue,
                lastName: lastNameValue,
                firstName: firstNameValue,
                initData: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = {
                telegramId,
                class: classValue,
                lastName: lastNameValue,
                firstName: firstNameValue,
                role: 'student'
            };
            showModal('success', 'Регистрация прошла успешно!');
            setTimeout(() => {
                showMainScreen();
            }, 2000);
        } else {
            showModal('error', data.message || 'Ошибка регистрации');
        }
    } catch (error) {
        console.log('Backend not available, using mock mode');
        
        const classSelect = document.getElementById('class-select');
        const lastName = document.getElementById('last-name');
        const firstName = document.getElementById('first-name');
        
        currentUser = {
            telegramId: tg.initDataUnsafe.user.id,
            class: classSelect.value,
            lastName: lastName.value.trim(),
            firstName: firstName.value.trim(),
            role: 'student'
        };
        showModal('success', 'Регистрация прошла успешно!');
        setTimeout(() => {
            showMainScreen();
        }, 2000);
    }
}

// Show main screen with user info
function showMainScreen() {
    if (!currentUser) {
        showScreen('registrationScreen');
        return;
    }
    
    // Update user info in UI
    const userName = document.getElementById('user-name');
    const userClass = document.getElementById('user-class');
    
    if (userName) {
        userName.textContent = currentUser.firstName;
    }
    
    if (userClass) {
        userClass.textContent = currentUser.class;
    }
    
    // Show/hide admin button based on user role
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
            adminBtn.style.display = 'block';
        } else {
            adminBtn.style.display = 'none';
        }
    }
    
    showScreen('mainScreen');
}

// Load assignments
async function loadAssignments(type = 'current') {
    try {
        if (!currentUser || !currentUser.class) {
            displayAssignments([]);
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/get-homework?class=${currentUser.class}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.homework) {
            const assignments = data.homework.map(hw => ({
                id: hw.id,
                date: hw.deadline,
                topic: hw.subject,
                description: hw.description
            }));
            
            // Filter by type (current/archived)
            const now = new Date();
            const filteredAssignments = assignments.filter(assignment => {
                const assignmentDate = new Date(assignment.date);
                if (type === 'current') {
                    return assignmentDate >= now;
                } else {
                    return assignmentDate < now;
                }
            });
            
            displayAssignments(filteredAssignments);
        } else {
            displayAssignments([]);
        }
    } catch (error) {
        console.log('Backend not available, using mock data');
        
        // Mock assignments
        const mockAssignments = type === 'current' ? [
            {
                id: '1',
                date: '2024-01-15',
                topic: 'Алгоритмы сортировки',
                description: 'Изучить алгоритмы пузырьковой сортировки и сортировки выбором. Написать программу на Python.'
            },
            {
                id: '2',
                date: '2024-01-12',
                topic: 'Основы HTML',
                description: 'Создать простую веб-страницу с использованием основных HTML тегов.'
            }
        ] : [
            {
                id: '3',
                date: '2024-01-10',
                topic: 'Переменные в Python',
                description: 'Изучить типы данных и работу с переменными в Python.'
            }
        ];
        
        displayAssignments(mockAssignments);
    }
}

// Display assignments
function displayAssignments(assignments) {
    const container = document.getElementById('assignments-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (assignments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--tg-theme-hint-color, #666666);">Заданий пока нет</p>';
        return;
    }
    
    assignments.forEach(assignment => {
        const card = document.createElement('div');
        card.className = 'assignment-card';
        
        card.innerHTML = `
            <div class="assignment-date">${formatDate(assignment.date)}</div>
            <div class="assignment-topic">${assignment.topic}</div>
            <div class="assignment-description">${assignment.description}</div>
        `;
        
        container.appendChild(card);
    });
}

// Switch assignment tab
function switchAssignmentTab(type) {
    const currentTab = document.getElementById('current-tab');
    const archivedTab = document.getElementById('archive-tab');
    
    if (type === 'current') {
        currentTab.classList.add('active');
        archivedTab.classList.remove('active');
    } else {
        currentTab.classList.remove('active');
        archivedTab.classList.add('active');
    }
    
    loadAssignments(type);
}

// Prefill submission form
function prefillSubmissionForm() {
    if (!currentUser) return;
    
    const submitClass = document.getElementById('submit-class');
    const submitLastName = document.getElementById('submit-last-name');
    const submitFirstName = document.getElementById('submit-first-name');
    
    if (submitClass) submitClass.textContent = currentUser.class;
    if (submitLastName) submitLastName.textContent = currentUser.lastName;
    if (submitFirstName) submitFirstName.textContent = currentUser.firstName;
}

// Handle homework submission
async function handleHomeworkSubmission(e) {
    e.preventDefault();
    
    try {
        if (!currentUser) {
            showModal('error', 'Пользователь не найден');
            return;
        }
        
        const fileInput = document.getElementById('homework-file');
        
        if (!fileInput || !fileInput.files.length) {
            showModal('error', 'Пожалуйста, выберите файл для отправки');
            return;
        }
        
        const file = fileInput.files[0];
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showModal('error', 'Размер файла не должен превышать 10MB');
            return;
        }
        
        // Convert file to base64
        const fileContent = await fileToBase64(file);
        const fileData = {
            fileName: file.name,
            fileContent: fileContent,
            fileType: file.type
        };
        
        const response = await fetch(`${API_BASE_URL}/submit-homework-sheets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegramId: currentUser.telegramId,
                homeworkId: '1', // TODO: Select from available homework
                initData: tg.initData,
                fileData: fileData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showModal('success', 'Домашнее задание успешно отправлено!');
            e.target.reset();
        } else {
            showModal('error', data.message || 'Ошибка при отправке задания');
        }
    } catch (error) {
        console.log('Backend not available, using mock mode');
        showModal('success', 'Домашнее задание успешно отправлено! (демо режим)');
        e.target.reset();
    }
}

// Handle add assignment (admin/teacher)
async function handleAddAssignment(e) {
    e.preventDefault();
    
    try {
        const assignmentDate = document.getElementById('assignment-date');
        const assignmentClass = document.getElementById('assignment-class');
        const assignmentTopic = document.getElementById('assignment-topic');
        const assignmentDescription = document.getElementById('assignment-description');
        
        if (!assignmentDate || !assignmentClass || !assignmentTopic || !assignmentDescription) {
            showModal('error', 'Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        const classValue = assignmentClass.value;
        const subject = assignmentTopic.value.trim();
        const description = assignmentDescription.value.trim();
        const deadline = assignmentDate.value;
        
        if (!deadline || !classValue || !subject || !description) {
            showModal('error', 'Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/add-homework`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegramId: currentUser.telegramId,
                class: classValue,
                subject: subject,
                description: description,
                deadline: deadline,
                initData: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showModal('success', 'Задание успешно добавлено!');
            e.target.reset();
        } else {
            showModal('error', data.message || 'Ошибка при добавлении задания');
        }
    } catch (error) {
        console.log('Backend not available, using mock mode');
        showModal('success', 'Задание успешно добавлено! (демо режим)');
        e.target.reset();
    }
}

// File upload setup
function setupFileUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('homework-file');
    
    if (!uploadArea || !fileInput) return;
    
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('drag-over');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('drag-over');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const fileInput = document.getElementById('homework-file');
        if (fileInput) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect.call(fileInput);
        }
    }
}

function handleFileSelect() {
    if (this.files && this.files.length > 0) {
        const file = this.files[0];
        updateFilePreview(file);
    }
}

function updateFilePreview(file) {
    const preview = document.getElementById('file-preview');
    const fileName = preview.querySelector('.file-name');
    const fileSize = preview.querySelector('.file-size');
    
    if (fileName) fileName.textContent = file.name;
    if (fileSize) {
        const size = file.size;
        const formattedSize = size > 1024 * 1024 
            ? (size / (1024 * 1024)).toFixed(1) + ' MB'
            : Math.ceil(size / 1024) + ' KB';
        fileSize.textContent = formattedSize;
    }
    
    if (preview) preview.style.display = 'block';
}

// Utility functions
function showScreen(screenId) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

function showModal(type, message) {
    if (tg && tg.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

function showError(message) {
    showModal('error', message);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}
