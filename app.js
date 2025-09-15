// Application state
let currentUser = null;
let currentScreen = 'loading';
let tg = null;
let isAdmin = false;

// API Configuration
const API_BASE_URL = '/.netlify/functions';

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting initialization...');
    try {
        initializeApp();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Ошибка инициализации приложения');
    }
});

// Initialize Telegram WebApp
function initializeApp() {
    console.log('Initializing app...');
    
    // Check if running in local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Local development mode detected');
        
        // Create mock Telegram object for local testing
        window.Telegram = window.Telegram || {};
        window.Telegram.WebApp = {
            initDataUnsafe: {
                user: {
                    id: 123456789,
                    first_name: 'Test',
                    last_name: 'User'
                }
            },
            initData: 'mock_init_data_for_testing',
            expand: function() { console.log('Mock: WebApp expanded'); },
            MainButton: {
                setText: function(text) { console.log('Mock: MainButton text set to:', text); },
                hide: function() { console.log('Mock: MainButton hidden'); },
                show: function() { console.log('Mock: MainButton shown'); }
            },
            BackButton: {
                hide: function() { console.log('Mock: BackButton hidden'); },
                show: function() { console.log('Mock: BackButton shown'); }
            },
            showAlert: function(message, callback) { 
                alert(message); 
                if (callback) callback();
            },
            close: function() { console.log('Mock: WebApp closed'); },
            onEvent: function(event, callback) { console.log('Mock: Event listener added for:', event); }
        };
        
        tg = window.Telegram.WebApp;
    } else {
        // Use real Telegram WebApp
        tg = window.Telegram?.WebApp;
        
        if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) {
            showError('Приложение должно запускаться из Telegram');
            return;
        }
    }
    
    // Initialize Telegram WebApp features
    tg.expand();
    tg.MainButton.setText('Готово');
    tg.MainButton.hide();
    
    console.log('Telegram WebApp initialized, checking user registration...');
    
    // Check if user is registered
    checkUserRegistration();
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Registration form
    const registrationForm = document.getElementById('registration-form');
    if (registrationForm) {
        registrationForm.addEventListener('submit', handleRegistration);
    }
    
    // Main menu buttons
    const checkHomeworkBtn = document.getElementById('check-homework-btn');
    if (checkHomeworkBtn) {
        checkHomeworkBtn.addEventListener('click', () => {
            showScreen('assignments');
            loadAssignments();
        });
    }
    
    const submitHomeworkBtn = document.getElementById('submit-homework-btn');
    if (submitHomeworkBtn) {
        submitHomeworkBtn.addEventListener('click', () => {
            showScreen('submission');
            prefillSubmissionForm();
        });
    }
    
    // Admin button (hidden by default)
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => showScreen('admin'));
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
        btn.addEventListener('click', () => showScreen('main'));
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
    
    // Setup file upload handlers
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('homework-file');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleFileDrop);
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
        
        console.log('File upload handlers set up successfully');
    } else {
        console.error('Upload area or file input not found');
    }
    
    // Modal close buttons
    const modalCloseButtons = document.querySelectorAll('.modal-close');
    modalCloseButtons.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Close modals on backdrop click
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    });
    
    console.log('Event listeners set up successfully');
}

// Check if user is already registered
async function checkUserRegistration() {
    try {
        console.log('Checking user registration...');
        
        if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) {
            console.error('Telegram data not available');
            showError('Ошибка инициализации Telegram');
            return;
        }
        
        const telegramId = tg.initDataUnsafe.user.id;
        console.log('User ID:', telegramId);
        
        // Try backend first, fallback to mock mode if it fails
        try {
            const response = await fetch(`${API_BASE_URL}/check-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegramId: telegramId,
                    initData: tg.initData
                })
            });
            
            const data = await response.json();
            
            if (data.success && data.user) {
                // User is registered
                currentUser = data.user;
                showMainMenu();
            } else {
                // User needs to register
                showScreen('registration');
            }
        } catch (error) {
            // Fallback to mock mode if backend is not available
            console.log('Backend not available, using mock mode for user check:', error);
            console.log('Mock: Checking user registration for ID:', telegramId);
            // Simulate that user is not registered for demo purposes
            setTimeout(() => {
                console.log('Mock: User not found, showing registration');
                showScreen('registration');
            }, 1000);
        }
    } catch (error) {
        console.error('Error checking user registration:', error);
        showError('Ошибка подключения к серверу');
    }
}

// Handle registration form submission
async function handleRegistration(e) {
    e.preventDefault();
    
    try {
        console.log('Handling registration...');
        
        const classSelect = document.getElementById('class-select');
        const lastName = document.getElementById('last-name');
        const firstName = document.getElementById('first-name');
        
        if (!classSelect || !lastName || !firstName) {
            showModal('error', 'Форма регистрации не найдена');
            return;
        }
        
        const userData = {
            telegramId: tg.initDataUnsafe.user.id,
            class: classSelect.value,
            lastName: lastName.value.trim(),
            firstName: firstName.value.trim()
        };
        
        if (!userData.class || !userData.lastName || !userData.firstName) {
            showModal('error', 'Пожалуйста, заполните все поля');
            return;
        }
        
        // Try backend first, fallback to mock mode if it fails
        try {
            const response = await fetch(`${API_BASE_URL}/register-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegramId: userData.telegramId,
                    initData: tg.initData,
                    userData: userData
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentUser = userData;
                showModal('success', 'Регистрация прошла успешно!');
                setTimeout(() => {
                    showMainMenu();
                }, 2000);
            } else {
                showModal('error', data.message || 'Ошибка регистрации');
            }
        } catch (error) {
            // Fallback to mock mode if backend is not available
            console.log('Backend not available, using mock mode:', error);
            console.log('Mock: Registering user:', userData);
            
            currentUser = userData;
            showModal('success', 'Регистрация прошла успешно! (демо режим)');
            setTimeout(() => {
                showMainMenu();
            }, 2000);
        }
    } catch (error) {
        console.error('Registration error:', error);
        showModal('error', 'Ошибка при регистрации');
    }
}

// Show main menu
function showMainMenu() {
    const userName = document.getElementById('user-name');
    const userClass = document.getElementById('user-class');
    
    if (userName && currentUser) {
        userName.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    }
    if (userClass && currentUser) {
        userClass.textContent = currentUser.class;
    }
    
    showScreen('main');
}

// Load assignments
async function loadAssignments(type = 'current') {
    try {
        // Try backend first, fallback to mock data if it fails
        try {
            const response = await fetch(`${API_BASE_URL}/get-assignments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegramId: tg.initDataUnsafe.user.id,
                    initData: tg.initData,
                    userClass: currentUser.class,
                    type: type
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                displayAssignments(data.assignments);
            } else {
                console.log('Backend returned error, using mock data');
                useMockAssignments(type);
            }
        } catch (error) {
            // Fallback to mock data if backend is not available
            console.log('Backend not available, using mock data:', error);
            useMockAssignments(type);
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
        useMockAssignments(type);
    }
}

// Use mock assignments data
function useMockAssignments(type) {
    console.log('Mock: Loading assignments for class:', currentUser?.class || 'Unknown', 'type:', type);
    
    const mockAssignments = type === 'current' ? [
                {
                    date: '2024-01-15',
                    topic: 'Алгоритмы сортировки',
                    description: 'Изучить алгоритмы пузырьковой сортировки и сортировки выбором. Написать программу на Python.'
                },
                {
                    date: '2024-01-12',
                    topic: 'Основы HTML',
                    description: 'Создать простую веб-страницу с использованием основных HTML тегов.'
                }
            ] : [
                {
                    date: '2024-01-10',
                    topic: 'Переменные в Python',
                    description: 'Изучить типы данных и работу с переменными в Python.'
                }
            ];
            
            setTimeout(() => {
                displayAssignments(mockAssignments);
            }, 500);
}

// Display assignments
function displayAssignments(assignments) {
    const container = document.getElementById('assignments-list');
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

// Handle homework submission form
async function handleHomeworkSubmission(e) {
    e.preventDefault();
    
    try {
        const form = e.target;
        const formData = new FormData(form);
        const fileInput = form.querySelector('input[type="file"]');
        
        const submissionData = {
            telegramId: tg.initDataUnsafe.user.id,
            class: formData.get('class'),
            lastName: formData.get('lastName'),
            firstName: formData.get('firstName'),
            assignmentDate: formData.get('assignmentDate'),
            assignmentTopic: formData.get('assignmentTopic')
        };
        
        let fileData = null;
        
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            
            console.log('File selected for submission:', file.name, file.size, file.type);
            
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                showModal('error', 'Размер файла не должен превышать 10MB');
                return;
            }
            
            // Convert file to base64
            const fileContent = await fileToBase64(file);
            fileData = {
                fileName: file.name,
                fileContent: fileContent,
                fileType: file.type,
                fileSize: file.size
            };
            
            console.log('File data prepared for upload:', fileData.fileName, fileData.fileSize);
        } else {
            console.log('No file selected for submission');
        }
        
        // Try backend first, fallback to mock mode if it fails
        try {
            const response = await fetch(`${API_BASE_URL}/submit-homework-new`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegramId: submissionData.telegramId,
                    initData: tg.initData,
                    submissionData: submissionData,
                    fileData: fileData
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showModal('success', 'Домашнее задание успешно отправлено!');
                form.reset();
                updateFileUploadUI();
            } else {
                showModal('error', data.message || 'Ошибка при отправке задания');
            }
        } catch (error) {
            // Fallback to mock mode if backend is not available
            console.log('Backend not available, using mock mode for homework submission:', error);
            console.log('Mock: Submitting homework:', submissionData);
            
            setTimeout(() => {
                showModal('success', 'Домашнее задание успешно отправлено! (демо режим)');
                form.reset();
                updateFileUploadUI();
            }, 1500);
        }
    } catch (error) {
        console.error('Homework submission error:', error);
        showModal('error', 'Ошибка при отправке задания');
    }
}

// Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove data:type/subtype;base64, prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// Handle admin form submission
async function handleAddAssignment(e) {
    e.preventDefault();
    
    try {
        console.log('Handling add assignment...');
        
        const assignmentDate = document.getElementById('assignment-date');
        const assignmentClass = document.getElementById('assignment-class');
        const assignmentTopic = document.getElementById('assignment-topic');
        const assignmentDescription = document.getElementById('assignment-description');
        const materialLink = document.getElementById('material-link');
        
        if (!assignmentDate || !assignmentClass || !assignmentTopic || !assignmentDescription) {
            showModal('error', 'Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        const assignmentData = {
            date: assignmentDate.value,
            class: assignmentClass.value,
            topic: assignmentTopic.value.trim(),
            description: assignmentDescription.value.trim(),
            materialLink: materialLink ? materialLink.value.trim() : ''
        };
        
        if (!assignmentData.date || !assignmentData.class || !assignmentData.topic || !assignmentData.description) {
            showModal('error', 'Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        // Try backend first, fallback to mock mode if it fails
        try {
            const response = await fetch(`${API_BASE_URL}/add-assignment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegramId: tg.initDataUnsafe.user.id,
                    initData: tg.initData,
                    assignmentData: assignmentData
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Reset form
                assignmentDate.value = '';
                assignmentClass.value = '';
                assignmentTopic.value = '';
                assignmentDescription.value = '';
                if (materialLink) materialLink.value = '';
                
                showModal('success', 'Домашнее задание успешно добавлено!');
            } else {
                showModal('error', data.message || 'Ошибка при добавлении задания');
            }
        } catch (error) {
            // Fallback to mock mode if backend is not available
            console.log('Backend not available, using mock mode for assignment creation:', error);
            console.log('Mock: Adding assignment:', assignmentData);
            
            setTimeout(() => {
                // Reset form
                assignmentDate.value = '';
                assignmentClass.value = '';
                assignmentTopic.value = '';
                assignmentDescription.value = '';
                if (materialLink) materialLink.value = '';
                
                showModal('success', 'Домашнее задание успешно добавлено! (демо режим)');
            }, 1000);
        }
    } catch (error) {
        console.error('Add assignment error:', error);
        showModal('error', 'Ошибка подключения к серверу');
    }
}

// Show specific screen
function showScreen(screenName) {
    console.log(`Switching to screen: ${screenName}`);
    
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(`${screenName}Screen`);
    if (targetScreen) {
        targetScreen.classList.add('active');
        currentScreen = screenName;
        
        // Handle screen-specific logic
        if (screenName === 'main') {
            showMainMenu();
        } else if (screenName === 'registration') {
            // Show registration screen
        } else if (screenName === 'assignments') {
            // loadAssignments will be called from event listener
        } else if (screenName === 'submission') {
            // prefillSubmissionForm will be called from event listener
        }
    } else {
        console.error(`Screen not found: ${screenName}Screen`);
    }
}

// Show error screen
function showError(message) {
    document.getElementById('error-message').textContent = message;
    showScreen('error');
}

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Show main menu with user info
function showMainMenu() {
    console.log('Showing main menu for user:', currentUser);
    
    if (currentUser) {
        // Update user info display
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.innerHTML = `
                <div class="user-card">
                    <div class="user-avatar">👤</div>
                    <div class="user-details">
                        <div class="user-name">${currentUser.firstName} ${currentUser.lastName}</div>
                        <div class="user-class">Класс: ${currentUser.class}</div>
                    </div>
                </div>
            `;
        }
        
        // Show/hide admin button based on user role
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            if (isAdmin || currentUser.isAdmin) {
                adminBtn.style.display = 'block';
            } else {
                adminBtn.style.display = 'none';
            }
        }
    }
    
    showScreen('main');
}

// Prefill submission form with user data
function prefillSubmissionForm() {
    console.log('Prefilling submission form...');
    
    if (currentUser) {
        const classField = document.getElementById('submit-class');
        const lastNameField = document.getElementById('submit-last-name');
        const firstNameField = document.getElementById('submit-first-name');
        
        if (classField) classField.value = currentUser.class || '';
        if (lastNameField) lastNameField.value = currentUser.lastName || '';
        if (firstNameField) firstNameField.value = currentUser.firstName || '';
    }
}

// Modal functions
function showModal(type, message) {
    console.log(`Showing ${type} modal:`, message);
    
    const modal = document.getElementById(`${type}Modal`);
    const messageElement = document.getElementById(`${type}Message`);
    
    if (modal && messageElement) {
        messageElement.textContent = message;
        modal.classList.add('active');
        
        // Auto-close success modals after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                closeModal();
            }, 3000);
        }
    }
}

function closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
}

// File upload handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect({ target: { files: files } });
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        const file = files[0];
        console.log('File selected:', file.name, file.size, file.type);
        
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            showModal('error', 'Размер файла не должен превышать 10MB');
            return;
        }
        
        // Update UI to show selected file
        updateFileUploadUI(file);
    }
}

function updateFileUploadUI(file = null) {
    const uploadArea = document.getElementById('upload-area');
    const uploadContent = uploadArea?.querySelector('.upload-content');
    
    if (!uploadArea || !uploadContent) return;
    
    if (file) {
        uploadArea.classList.add('file-selected');
        uploadContent.innerHTML = `
            <div class="upload-icon">✅</div>
            <div class="upload-text">
                <div class="upload-title">Файл выбран</div>
                <div class="upload-subtitle">${file.name}</div>
                <div class="upload-formats">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
        `;
    } else {
        uploadArea.classList.remove('file-selected');
        uploadContent.innerHTML = `
            <div class="upload-icon">📁</div>
            <div class="upload-text">
                <div class="upload-title">Перетащи файл сюда</div>
                <div class="upload-subtitle">или нажми для выбора</div>
                <div class="upload-formats">PDF, DOC, DOCX, TXT, JPG, PNG, ZIP</div>
            </div>
        `;
    }
}

// Assignment tab switching
function switchAssignmentTab(type) {
    console.log(`Switching to ${type} assignments tab`);
    
    // Update tab buttons
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const activeTab = document.getElementById(`${type}-tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Load assignments for the selected tab
    loadAssignments(type);
}

// Handle Telegram WebApp events (only if tg is available)
if (typeof tg !== 'undefined' && tg && tg.onEvent) {
    tg.onEvent('mainButtonClicked', function() {
        // Handle main button click if needed
        console.log('Main button clicked');
    });

    tg.onEvent('backButtonClicked', function() {
        // Handle back button
        console.log('Back button clicked, current screen:', currentScreen);
        switch (currentScreen) {
            case 'assignments':
            case 'submission':
            case 'admin':
                showScreen('main');
                break;
            case 'registration':
                // Can't go back from registration
                break;
            default:
                showScreen('main');
                break;
        }
    });
}
// Show back button when not on main screen
function updateBackButton() {
    if (currentScreen === 'main-menu' || currentScreen === 'loading' || currentScreen === 'registration') {
        tg.BackButton.hide();
    } else {
        tg.BackButton.show();
    }
}

// Update back button when screen changes
const originalShowScreen = showScreen;
showScreen = function(screenName) {
    originalShowScreen(screenName);
    updateBackButton();
};
