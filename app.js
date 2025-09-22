// Global variables
let tg;
let currentUser = null;
let currentAssignments = [];
let archivedAssignments = [];
let selectedFile = null;
let isInitialized = false; // Prevent multiple initializations
let currentScreen = 'loading'; // Track current screen
let isAdmin = false; // Flag for admin users

const API_BASE_URL = '/.netlify/functions';

// Debug flag
const DEBUG = false;

// Debug functions
function updateDebugInfo() {
    const debugCurrentUser = document.getElementById('debugCurrentUser');
    const debugTelegramData = document.getElementById('debugTelegramData');
    
    if (debugCurrentUser) {
        debugCurrentUser.textContent = JSON.stringify(currentUser, null, 2);
    }
    
    if (debugTelegramData && tg) {
        debugTelegramData.textContent = JSON.stringify({
            user: tg.initDataUnsafe?.user,
            initData: tg.initData ? tg.initData.substring(0, 100) + '...' : 'none'
        }, null, 2);
    }
}

function updateDebugApiResponse(response) {
    const debugApiResponse = document.getElementById('debugApiResponse');
    if (debugApiResponse) {
        debugApiResponse.textContent = JSON.stringify(response, null, 2);
    }
}

function toggleDebug() {
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
        if (debugPanel.style.display === 'none' || !debugPanel.style.display) {
            debugPanel.style.display = 'block';
            updateDebugInfo();
        } else {
            debugPanel.style.display = 'none';
        }
    }
}

// Debug logging system
let debugLogs = [];
let debugPanelVisible = false;

function debugLog(message, data = null) {
    if (!DEBUG) return;
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    debugLogs.push(logEntry);
    if (data) {
        debugLogs.push(`  Data: ${JSON.stringify(data, null, 2)}`);
    }
    
    // Keep only last 50 logs
    if (debugLogs.length > 50) {
        debugLogs = debugLogs.slice(-50);
    }
    
    updateDebugPanel();
    
    // Also log to console if available
    console.log(logEntry, data);
}

function updateDebugPanel() {
    if (!DEBUG) return;
    const debugLogsElement = document.getElementById('debug-logs');
    if (debugLogsElement) {
        debugLogsElement.innerHTML = debugLogs.map(log => 
            `<div class="text-xs">${log}</div>`
        ).join('');
        debugLogsElement.scrollTop = debugLogsElement.scrollHeight;
    }
}

function toggleDebugPanel() {
    if (!DEBUG) return;
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
        debugPanelVisible = !debugPanelVisible;
        debugPanel.classList.toggle('hidden', !debugPanelVisible);
    }
}

// Clear all debug logs and user data
function clearAppData() {
    debugLog('Clearing all app data...');
    currentUser = null;
    debugLogs = [];
    updateDebugInfo();
    updateDebugPanel();
    debugLog('App data cleared');
}

// Initialize the app
window.addEventListener('load', function() {
    console.log('Window loaded, starting initialization...');
    
    // Prevent multiple initializations
    if (isInitialized) {
        console.log('App already initialized, skipping...');
        return;
    }
    
    // Show loading screen first
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.add('active');
    } else {
        console.warn('Loading screen element not found');
    }
    
    // Try immediate initialization first
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            console.log('Telegram WebApp detected on window load, initializing immediately...');
            initializeApp();
            isInitialized = true;
            return;
        }
    } catch (e) {
        console.warn('Could not initialize immediately:', e);
    }
    
    // If direct initialization failed, try with a delay as fallback
    setTimeout(() => {
        if (!isInitialized) {
            console.log('Delayed initialization...');
            try {
                initializeApp();
                isInitialized = true;
            } catch (error) {
                console.error('Initialization error:', error);
                debugLog('Initialization error:', error);
                showError('Ошибка инициализации приложения');
            }
        }
    }, 500);
});

// Backup initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded event');
    if (!isInitialized) {
        console.log('App not yet initialized on DOMContentLoaded, scheduling backup...');
        setTimeout(() => {
            if (!isInitialized) {
                console.log('Backup initialization...');
                try {
                    initializeApp();
                    isInitialized = true;
                } catch (error) {
                    console.error('Backup initialization error:', error);
                }
            }
        }, 1000);
    }
});

// Debug function to diagnose screens
function diagnoseScreens() {
    console.log('Diagnosing all screens:');
    const screens = document.querySelectorAll('.screen');
    console.log(`Found ${screens.length} screens:`);
    
    screens.forEach(screen => {
        const id = screen.id;
        const isActive = screen.classList.contains('active');
        const display = window.getComputedStyle(screen).display;
        console.log(`Screen ID: ${id}, Active: ${isActive}, Display: ${display}`);
    });
    
    // Check specific screens
    const expectedScreens = ['loadingScreen', 'registrationScreen', 'mainScreen', 'error-screen', 'assignmentsScreen'];
    expectedScreens.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✅ ${id} exists`); 
        } else {
            console.error(`❌ ${id} not found!`);
        }
    });
}

// Initialize Telegram WebApp
function initializeApp() {
    console.log('Initializing app...');
    debugLog('Initializing app...');
    
    // Diagnose screens on initialization
    diagnoseScreens();
    
    // Clear any previous app state
    clearAppData();
    
    // Check if running in local development
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    debugLog('Environment:', isLocal ? 'Local development' : 'Production');
    
    // Initialize Telegram WebApp
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            tg = window.Telegram.WebApp;
            tg.ready();
            
            console.log('Telegram WebApp initialized with data:', tg.initDataUnsafe?.user);
            debugLog('Telegram WebApp initialized');
            debugLog('Telegram user data:', tg.initDataUnsafe?.user);
            
            // Set up the app
            setupEventListeners();
            checkUserRegistration();
        } else {
            console.warn('Telegram WebApp not available, using mock mode');
            debugLog('Telegram WebApp not available - running in mock mode');
            
            // Mock mode for testing
            tg = {
                initDataUnsafe: {
                    user: { id: 123456789, first_name: 'Test', last_name: 'User' }
                },
                initData: 'mock_init_data',
                BackButton: {
                    show: function() { debugLog('Mock: BackButton shown'); },
                    hide: function() { debugLog('Mock: BackButton hidden'); },
                    isVisible: false
                },
                showAlert: function(message, callback) { 
                    alert(message); 
                    if (callback) callback();
                },
                close: function() { debugLog('Mock: WebApp closed'); },
                onEvent: function(event, callback) { 
                    debugLog('Mock: Event listener added for:', event); 
                    // Simulate the event listener
                    if (event === 'mainButtonClicked') {
                        // Nothing to do
                    }
                }
            };
            
            // В тестовом режиме показываем сообщение
            console.log('Running in mock mode with test user ID: 123456789');
            
            setupEventListeners();
            checkUserRegistration();
        }
    } catch (error) {
        console.error('Error initializing Telegram WebApp:', error);
        showError('Ошибка при инициализации Telegram WebApp');
    }
}

// Setup event listeners
function setupEventListeners() {
    debugLog('Setting up event listeners...');
    
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
        btn.addEventListener('click', () => safelyShowMainScreen());
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
        
        // Initialize upload UI
        updateFileUploadUI();
        debugLog('File upload handlers set up successfully');
    } else {
        debugLog('Upload area or file input not found');
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
    
    debugLog('Event listeners set up successfully');
}

// Check if user is already registered
async function checkUserRegistration() {
    try {
        debugLog('Checking user registration...');
        
        // Clear any old user data from memory
        currentUser = null;
        updateDebugInfo();
        
        if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) {
            debugLog('Telegram data not available');
            showError('Ошибка инициализации Telegram');
            return;
        }
        
        const telegramId = tg.initDataUnsafe.user.id;
        debugLog('User ID:', telegramId);
        
        // Use Google Sheets API to get user
        try {
            const response = await fetch(`${API_BASE_URL}/get-user?telegramId=${telegramId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            updateDebugApiResponse(data);
            
            if (data.success && data.user) {
                // User is registered
                currentUser = data.user;
                console.log('User found from Google Sheets:', currentUser);
                updateDebugInfo();
                safelyShowMainScreen();
            } else {
                // User needs to register
                console.log('User not found, showing registration');
                showScreen('registration');
            }
        } catch (error) {
            // Fallback to mock mode if backend is not available
            console.log('Backend not available, using mock mode for user check:', error);
            console.log('Mock: Checking user registration for ID:', telegramId);
            updateDebugApiResponse({ error: error.message, mode: 'mock' });
            
            // Show registration screen immediately without recursion
            console.log('Mock: User not found, showing registration');
            showScreen('registration');
        }
    } catch (error) {
        debugLog('Error checking user registration:', error);
        showError('Ошибка подключения к серверу');
    }
}

// Handle registration form submission
async function handleRegistration(e) {
    e.preventDefault();
    
    try {
        debugLog('Handling registration...');
        
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
        
        // Use Google Sheets API to register student
        try {
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
                    firstName: firstNameValue
                };
                showModal('success', 'Регистрация прошла успешно!');
                setTimeout(() => {
                    safelyShowMainScreen();
                }, 2000);
            } else {
                showModal('error', data.message || 'Ошибка регистрации');
            }
        } catch (error) {
            // Fallback to mock mode if backend is not available
            debugLog('Backend not available, using mock mode:', error);
            debugLog('Mock: Registering user:', { telegramId, class: classValue, lastName: lastNameValue, firstName: firstNameValue });
            
            currentUser = {
                telegramId,
                class: classValue,
                lastName: lastNameValue,
                firstName: firstNameValue
            };
            showModal('success', 'Регистрация прошла успешно! (демо режим)');
            setTimeout(() => {
                safelyShowMainScreen();
            }, 2000);
        }
    } catch (error) {
        debugLog('Registration error:', error);
        showModal('error', 'Ошибка при регистрации');
    }
}

// Переместили функцию showMainMenu ниже в код с улучшенной реализацией

// Load assignments
async function loadAssignments(type = 'current') {
    try {
        // Determine which class(es) to load assignments for
        let classesToLoad = [];
        
        if (currentUser && currentUser.isTeacher) {
            // Teachers can see assignments for all their classes
            if (currentUser.classes && currentUser.classes.length > 0) {
                classesToLoad = currentUser.classes;
            } else {
                // If no specific classes, show message
                debugLog('Teacher has no assigned classes');
                displayAssignments([]);
                return;
            }
        } else if (currentUser && currentUser.class) {
            // Students see assignments for their class only
            classesToLoad = [currentUser.class];
        } else {
            debugLog('No user class available, cannot load assignments');
            useMockAssignments(type);
            return;
        }
        
        // Try Google Sheets API first, fallback to mock data if it fails
        try {
            // For teachers with multiple classes, we need to fetch assignments for each class
            let allAssignments = [];
            
            for (const classGroup of classesToLoad) {
                const response = await fetch(`${API_BASE_URL}/get-homework?class=${classGroup}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                const data = await response.json();
                
                if (data.success && data.homework) {
                    // Add class info to each assignment for display
                    const classAssignments = data.homework.map(hw => ({
                        ...hw,
                        displayClass: classGroup // Add class for display purposes
                    }));
                    allAssignments = allAssignments.concat(classAssignments);
                }
            }
            
            // Process all assignments
            if (allAssignments.length > 0) {
                // Transform the homework data to match our expected format
                const assignments = allAssignments.map(hw => ({
                    id: hw.id,
                    date: hw.deadline,  // Use deadline as display date
                    topic: hw.subject,
                    description: hw.description,
                    class: hw.displayClass // Include class info for teachers
                }));
                
                // Sort by date, more recent first for current, older first for archived
                const now = new Date();
                const currentItems = [];
                const archivedItems = [];
                
                assignments.forEach(assignment => {
                    const assignmentDate = new Date(assignment.date);
                    if (type === 'current' && assignmentDate >= now) {
                        currentItems.push(assignment);
                    } else if (type === 'archived' && assignmentDate < now) {
                        archivedItems.push(assignment);
                    }
                });
                
                // Sort assignments by date
                currentItems.sort((a, b) => new Date(a.date) - new Date(b.date));
                archivedItems.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                // Display appropriate assignments
                const displayItems = type === 'current' ? currentItems : archivedItems;
                displayAssignments(displayItems);
            } else {
                debugLog('No assignments found, using mock data');
                useMockAssignments(type);
            }
        } catch (error) {
            // Fallback to mock data if backend is not available
            debugLog('Backend not available, using mock data:', error);
            useMockAssignments(type);
        }
    } catch (error) {
        debugLog('Error loading assignments:', error);
        useMockAssignments(type);
    }
}

// Use mock assignments data
function useMockAssignments(type) {
    debugLog('Mock: Loading assignments for class:', currentUser?.class || 'Unknown', 'type:', type);
    
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
        
        // Show class info for teachers
        const classInfo = assignment.class && currentUser && currentUser.isTeacher 
            ? `<div class="assignment-class">Класс: ${assignment.class}</div>` 
            : '';
        
        card.innerHTML = `
            <div class="assignment-date">${formatDate(assignment.date)}</div>
            ${classInfo}
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
        if (!currentUser) {
            showModal('error', 'Пользователь не найден');
            return;
        }
        
        const form = e.target;
        const fileInput = form.querySelector('input[type="file"]');
        
        const telegramId = tg.initDataUnsafe.user.id;
        
        // For now, just use a placeholder for homeworkId
        // In a real implementation, you would select from available homework assignments
        const homeworkId = '1';
        
        let fileData = null;
        
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            
            debugLog('File selected for submission:', file.name, file.size, file.type);
            
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                showModal('error', 'Размер файла не должен превышать 10MB');
                return;
            }
            
            // Convert file to base64
            const fileContent = await fileToBase64(file);
            fileData = {
                fileName: file.name,
                fileContent: fileContent,
                fileType: file.type
            };
            
            debugLog('File data prepared for upload:', fileData.fileName, file.size);
        } else {
            showModal('error', 'Пожалуйста, выберите файл для отправки');
            return;
        }
        
        // Try Google Sheets API first, fallback to mock mode if it fails
        try {
            const response = await fetch(`${API_BASE_URL}/submit-homework-sheets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegramId: telegramId,
                    homeworkId: homeworkId,
                    initData: tg.initData,
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
            debugLog('Backend not available, using mock mode for homework submission:', error);
            debugLog('Mock: Submitting homework for user:', telegramId, 'homework:', homeworkId);
            
            setTimeout(() => {
                showModal('success', 'Домашнее задание успешно отправлено! (демо режим)');
                form.reset();
                updateFileUploadUI();
            }, 1500);
        }
    } catch (error) {
        debugLog('Homework submission error:', error);
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

// File upload handlers
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
        selectedFile = file;
        updateFileUploadUI();
        debugLog('File selected:', file.name, file.size, file.type);
    }
}

function updateFileUploadUI() {
    const uploadArea = document.getElementById('upload-area');
    const fileNameDisplay = document.getElementById('file-name');
    const fileSizeDisplay = document.getElementById('file-size');
    const fileIcon = document.getElementById('file-icon');
    
    if (!uploadArea) {
        debugLog('Upload area not found');
        return;
    }
    
    if (selectedFile) {
        uploadArea.classList.add('has-file');
        
        if (fileNameDisplay) {
            fileNameDisplay.textContent = selectedFile.name;
        }
        
        if (fileSizeDisplay) {
            // Format size in KB or MB
            const size = selectedFile.size;
            let formattedSize;
            
            if (size > 1024 * 1024) {
                formattedSize = (size / (1024 * 1024)).toFixed(1) + ' MB';
            } else {
                formattedSize = Math.ceil(size / 1024) + ' KB';
            }
            
            fileSizeDisplay.textContent = formattedSize;
        }
        
        if (fileIcon) {
            // Set icon based on file type
            if (selectedFile.type.includes('image')) {
                fileIcon.textContent = '🖼️';
            } else if (selectedFile.type.includes('pdf')) {
                fileIcon.textContent = '📄';
            } else if (selectedFile.type.includes('word') || selectedFile.name.endsWith('.doc') || selectedFile.name.endsWith('.docx')) {
                fileIcon.textContent = '📝';
            } else {
                fileIcon.textContent = '📎';
            }
        }
    } else {
        uploadArea.classList.remove('has-file');
        
        if (fileNameDisplay) {
            fileNameDisplay.textContent = '';
        }
        
        if (fileSizeDisplay) {
            fileSizeDisplay.textContent = '';
        }
        
        if (fileIcon) {
            fileIcon.textContent = '📤';
        }
    }
}

// Handle admin form submission
async function handleAddAssignment(e) {
    e.preventDefault();
    
    try {
        debugLog('Handling add assignment...');
        
        const assignmentDate = document.getElementById('assignment-date');
        const assignmentClass = document.getElementById('assignment-class');
        const assignmentTopic = document.getElementById('assignment-topic');
        const assignmentDescription = document.getElementById('assignment-description');
        const materialLink = document.getElementById('assignment-link');
        
        if (!assignmentDate || !assignmentClass || !assignmentTopic || !assignmentDescription) {
            showModal('error', 'Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        const classValue = assignmentClass.value;
        const subject = assignmentTopic.value.trim();
        const description = assignmentDescription.value.trim();
        const deadline = assignmentDate.value;
        const link = materialLink ? materialLink.value.trim() : '';
        
        if (!deadline || !classValue || !subject || !description) {
            showModal('error', 'Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        // Try Google Sheets API first, fallback to mock mode if it fails
        try {
            const response = await fetch(`${API_BASE_URL}/add-homework`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    adminId: tg.initDataUnsafe.user.id, // Add admin ID for permission check
                    class: classValue,
                    subject: subject,
                    description: description + (link ? `\n\nСсылка на материалы: ${link}` : ''),
                    deadline: deadline,
                    initData: tg.initData // Add for validation
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
            debugLog('Backend not available, using mock mode for assignment creation:', error);
            debugLog('Mock: Adding assignment:', { class: classValue, subject, description, deadline });
            
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
        debugLog('Add assignment error:', error);
        showModal('error', 'Ошибка подключения к серверу');
    }
}

// Show specific screen
function showScreen(screenName) {
    console.log(`Switching to screen: ${screenName}`);
    debugLog(`Switching to screen: ${screenName}`);
    
    // Update current screen
    currentScreen = screenName;
    
    // Handle special case for error-screen which doesn't have 'Screen' suffix
    let targetId = screenName === 'error-screen' ? 'error-screen' : `${screenName}Screen`;
    
    // Hide loading screen explicitly
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.remove('active');
        console.log('Removed active class from loadingScreen');
    } else {
        console.warn('Loading screen element not found');
    }
    
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    if (screens.length === 0) {
        console.error('No screens found with .screen class!');
    } else {
        console.log(`Found ${screens.length} screens to hide`);
        screens.forEach(screen => {
            screen.classList.remove('active');
        });
    }
    
    // Show target screen
    const targetScreen = document.getElementById(targetId);
    if (targetScreen) {
        console.log(`Showing screen: ${targetId}`);
        targetScreen.classList.add('active');
        targetScreen.style.display = 'block';
        
        // Special handling for main screen
        if (screenName === 'main') {
            console.log('Special handling for main screen');
            // Don't call showMainMenu recursively from here to prevent stack overflow
            if (targetId !== 'mainScreen') {
                showMainMenu();
            }
        }
    } else {
        console.error(`Target screen not found: ${targetId}`);
        debugLog(`Screen not found: ${targetId}`);
        diagnoseScreens(); // Show diagnostics
        
        // Emergency fallback - show registration
        if (screenName !== 'registration' && screenName !== 'error-screen') {
            console.log('Emergency fallback to registration screen');
            const regScreen = document.getElementById('registrationScreen');
            if (regScreen) {
                regScreen.classList.add('active');
                regScreen.style.display = 'block';
            }
        }
    }
    
    // Update back button based on current screen
    updateBackButton();
}

// Show error screen
function showError(message) {
    console.error('Showing error screen with message:', message);
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
    } else {
        console.error('Error message element not found');
    }
    // 'error-screen' - это ID элемента в HTML
    showScreen('error-screen');
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
    debugLog('Showing main menu for user:', currentUser);
    
    // Update user display in main menu
    updateMainMenuUserDisplay();
    
    // Safely show main screen without recursion
    if (currentScreen !== 'main') {
        safelyShowMainScreen();
    }
}

// Safely show main screen without triggering recursion
function safelyShowMainScreen() {
    console.log('Safely showing main screen');
    currentScreen = 'main';
    
    // Hide all screens first
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show main screen
    const mainScreen = document.getElementById('mainScreen');
    if (mainScreen) {
        mainScreen.classList.add('active');
        mainScreen.style.display = 'block';
        console.log('Main screen activated');
    } else {
        console.error('Main screen element not found!');
    }
    
    // Update back button
    updateBackButton();
}

// Update user display in main menu
function updateMainMenuUserDisplay() {
    // Update name and class in the UI
    const userName = document.getElementById('user-name');
    const userClass = document.getElementById('user-class');
    
    if (userName) {
        userName.textContent = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Гость';
    }
    
    if (userClass) {
        if (currentUser && currentUser.isTeacher) {
            // For teachers, show their subject and classes
            const classesText = currentUser.classes && currentUser.classes.length > 0 
                ? currentUser.classes.join(', ') 
                : 'Все классы';
            userClass.textContent = `${currentUser.subject} (${classesText})`;
        } else if (currentUser && currentUser.class) {
            userClass.textContent = currentUser.class;
        } else {
            userClass.textContent = 'Не указан';
        }
    }
    
    // Update user info display if present
    if (currentUser) {
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
        const adminBtn = document.getElementById('admin-btn'); // Исправлено с adminBtn на admin-btn
        if (adminBtn) {
            // Show admin button for admins and teachers
            const canAddHomework = isAdmin || 
                                  currentUser.isAdmin || 
                                  currentUser.isTeacher || 
                                  (currentUser.role && (currentUser.role === 'admin' || currentUser.role === 'teacher'));
            
            if (canAddHomework) {
                adminBtn.style.display = 'block';
                // Update button text based on role
                const buttonText = adminBtn.querySelector('.btn-text') || adminBtn;
                if (currentUser.isTeacher && !currentUser.isAdmin && currentUser.role !== 'admin') {
                    buttonText.textContent = '📝 Добавить задание';
                } else {
                    buttonText.textContent = '⚙️ Админ панель';
                }
                console.log('Admin/Teacher button shown for:', currentUser.role || 'admin');
            } else {
                adminBtn.style.display = 'none';
            }
        } else {
            console.warn('Admin button not found');
        }
    }
}

// Prefill submission form with user data
function prefillSubmissionForm() {
    debugLog('Prefilling submission form...');
    debugLog('Current user data:', currentUser);
    
    if (currentUser) {
        const classField = document.getElementById('submit-class');
        const lastNameField = document.getElementById('submit-last-name');
        const firstNameField = document.getElementById('submit-first-name');
        
        if (classField) {
            classField.value = currentUser.class || '';
            debugLog('Set class field to:', currentUser.class);
        }
        if (lastNameField) {
            lastNameField.value = currentUser.lastName || '';
            debugLog('Set lastName field to:', currentUser.lastName);
        }
        if (firstNameField) {
            firstNameField.value = currentUser.firstName || '';
            debugLog('Set firstName field to:', currentUser.firstName);
        }
    } else {
        debugLog('No currentUser data available for prefilling');
    }
}

// Modal functions
function showModal(type, message) {
    debugLog(`Showing ${type} modal:`, message);
    
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
        debugLog('File selected:', file.name, file.size, file.type);
        
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
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
    debugLog(`Switching to ${type} assignments tab`);
    
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
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (typeof tg !== 'undefined' && tg && tg.onEvent) {
            debugLog('Setting up Telegram WebApp event handlers');
            tg.onEvent('mainButtonClicked', function() {
                // Handle main button click if needed
                debugLog('Main button clicked');
            });
        
            tg.onEvent('backButtonClicked', function() {
                // Handle back button
                debugLog('Back button clicked, current screen:', currentScreen);
                console.log('Handling back button, current screen:', currentScreen);
                switch (currentScreen) {
                    case 'assignments':
                    case 'submission':
                    case 'admin':
                        safelyShowMainScreen();
                        break;
                    case 'registration':
                        // Can't go back from registration
                        console.log('Cannot go back from registration screen');
                        break;
                    default:
                        safelyShowMainScreen();
                        break;
                }
            });
            debugLog('Telegram WebApp event handlers set up successfully');
        }
    }, 300);
});
// Show back button when not on main screen
function updateBackButton() {
    if (currentScreen === 'main' || currentScreen === 'loading' || currentScreen === 'registration') {
        if (tg && tg.BackButton) {
            tg.BackButton.hide();
        }
    } else {
        if (tg && tg.BackButton) {
            tg.BackButton.show();
        }
    }
}

// Функция updateBackButton вызывается непосредственно в showScreen
