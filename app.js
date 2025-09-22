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
    
    // View submissions button
    const viewSubmissionsBtn = document.getElementById('view-submissions-btn');
    if (viewSubmissionsBtn) {
        viewSubmissionsBtn.addEventListener('click', () => {
            showScreen('submissionsScreen');
            loadSubmissions();
        });
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
        if (currentUser.role === 'admin') {
            userClass.textContent = 'Администратор';
        } else if (currentUser.role === 'teacher') {
            userClass.textContent = `Учитель (${currentUser.subject || 'Предмет не указан'})`;
        } else {
            userClass.textContent = currentUser.class || 'Класс не указан';
        }
    }
    
    // Show/hide buttons based on user role
    const adminBtn = document.getElementById('admin-btn');
    const checkHomeworkBtn = document.getElementById('check-homework-btn');
    const submitHomeworkBtn = document.getElementById('submit-homework-btn');
    
    if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
        // Admin/Teacher interface - show only admin panel
        if (adminBtn) adminBtn.style.display = 'block';
        if (checkHomeworkBtn) checkHomeworkBtn.style.display = 'none'; // Админы не смотрят ДЗ как ученики
        if (submitHomeworkBtn) submitHomeworkBtn.style.display = 'none'; // Админы не сдают ДЗ
    } else {
        // Student interface
        if (adminBtn) adminBtn.style.display = 'none';
        if (checkHomeworkBtn) checkHomeworkBtn.style.display = 'block';
        if (submitHomeworkBtn) submitHomeworkBtn.style.display = 'block';
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
    
    // Load available homework for submission
    loadHomeworkForSubmission();
}

// Load homework assignments for submission
async function loadHomeworkForSubmission() {
    try {
        if (!currentUser || !currentUser.class) return;
        
        const response = await fetch(`${API_BASE_URL}/get-homework?class=${currentUser.class}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        const homeworkSelect = document.getElementById('homework-select');
        
        if (!homeworkSelect) return;
        
        homeworkSelect.innerHTML = '<option value="">Выберите задание</option>';
        
        if (data.success && data.homework) {
            // Filter current assignments only
            const now = new Date();
            const currentAssignments = data.homework.filter(hw => {
                const deadline = new Date(hw.deadline);
                return deadline >= now;
            });
            
            if (currentAssignments.length === 0) {
                homeworkSelect.innerHTML = '<option value="">Нет доступных заданий</option>';
                return;
            }
            
            currentAssignments.forEach(hw => {
                const option = document.createElement('option');
                option.value = hw.id;
                option.textContent = `${hw.subject} - ${formatDate(hw.deadline)}`;
                homeworkSelect.appendChild(option);
            });
        } else {
            homeworkSelect.innerHTML = '<option value="">Нет доступных заданий</option>';
        }
    } catch (error) {
        console.log('Error loading homework for submission:', error);
        const homeworkSelect = document.getElementById('homework-select');
        if (homeworkSelect) {
            homeworkSelect.innerHTML = '<option value="mock">Тестовое задание (демо режим)</option>';
        }
    }
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
        const homeworkSelect = document.getElementById('homework-select');
        
        if (!homeworkSelect || !homeworkSelect.value) {
            showModal('error', 'Пожалуйста, выберите задание');
            return;
        }
        
        if (!fileInput || !fileInput.files.length) {
            showModal('error', 'Пожалуйста, выберите файл для отправки');
            return;
        }
        
        const file = fileInput.files[0];
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showModal('error', 'Размер файла не должен превышать 10MB');
            return;
        }
        
        // Show loading animation
        showLoadingModal('📤 Отправляем файл...', 'Подготавливаем файл к отправке');
        updateProgress(10);
        
        // Convert file to base64
        updateProgress(30);
        updateLoadingText('📤 Обрабатываем файл...', 'Конвертируем в нужный формат');
        const fileContent = await fileToBase64(file);
        const fileData = {
            fileName: file.name,
            fileContent: fileContent,
            fileType: file.type
        };
        
        updateProgress(50);
        updateLoadingText('☁️ Загружаем в облако...', 'Сохраняем на Yandex.Disk');
        
        const response = await fetch(`${API_BASE_URL}/submit-homework-sheets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegramId: currentUser.telegramId,
                homeworkId: homeworkSelect.value,
                initData: tg.initData,
                fileData: fileData
            })
        });
        
        updateProgress(80);
        updateLoadingText('📝 Сохраняем запись...', 'Обновляем базу данных');
        
        const data = await response.json();
        
        updateProgress(100);
        
        // Hide loading modal after a short delay
        setTimeout(() => {
            hideLoadingModal();
            
            if (data.success) {
                showModal('success', 'Домашнее задание успешно отправлено!');
                e.target.reset();
            } else {
                showModal('error', data.message || 'Ошибка при отправке задания');
            }
        }, 500);
        
    } catch (error) {
        hideLoadingModal();
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
                adminId: currentUser.telegramId,
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

// Load submissions for admin
async function loadSubmissions() {
    try {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'teacher')) {
            showModal('error', 'Доступ запрещен');
            return;
        }

        // Load submissions and homework data
        const [submissionsResponse, homeworkResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/get-submissions?adminId=${currentUser.telegramId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }),
            // Load all homework to get subject names
            fetch(`${API_BASE_URL}/get-homework?class=all`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            })
        ]);

        const submissionsData = await submissionsResponse.json();
        const homeworkData = await homeworkResponse.json();

        if (submissionsData.success) {
            // Create homework map for better display
            const homeworkMap = {};
            if (homeworkData.success && homeworkData.homework) {
                homeworkData.homework.forEach(hw => {
                    homeworkMap[hw.id] = hw;
                });
            }
            
            // Populate filters
            populateSubmissionFilters(submissionsData.submissions, homeworkMap);
            displaySubmissions(submissionsData.submissions);
        } else {
            displaySubmissions([]);
        }
    } catch (error) {
        console.log('Error loading submissions:', error);
        displaySubmissions([]);
    }
}

// Populate filters for submissions
function populateSubmissionFilters(submissions, homeworkMap = {}) {
    const homeworkFilter = document.getElementById('submissions-homework-filter');
    const classFilter = document.getElementById('submissions-class-filter');
    
    if (!homeworkFilter || !classFilter) return;
    
    // Get unique homework IDs and classes
    const homeworkIds = [...new Set(submissions.map(sub => sub.homeworkId))];
    const classes = [...new Set(submissions.map(sub => sub.class))].sort();
    
    // Populate homework filter
    homeworkFilter.innerHTML = '<option value="">Все задания</option>';
    homeworkIds.forEach(hwId => {
        const option = document.createElement('option');
        option.value = hwId;
        
        // Show subject and deadline if available
        const homework = homeworkMap[hwId];
        if (homework) {
            option.textContent = `${homework.subject} (до ${formatDate(homework.deadline)})`;
        } else {
            option.textContent = `Задание ${hwId}`;
        }
        
        homeworkFilter.appendChild(option);
    });
    
    // Populate class filter
    classFilter.innerHTML = '<option value="">Все классы</option>';
    classes.forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        option.textContent = className;
        classFilter.appendChild(option);
    });
    
    // Add event listeners for filtering (remove old listeners first)
    homeworkFilter.removeEventListener('change', filterSubmissions);
    classFilter.removeEventListener('change', filterSubmissions);
    homeworkFilter.addEventListener('change', filterSubmissions);
    classFilter.addEventListener('change', filterSubmissions);
}

// Filter submissions based on selected filters
function filterSubmissions() {
    const homeworkFilter = document.getElementById('submissions-homework-filter');
    const classFilter = document.getElementById('submissions-class-filter');
    
    if (!homeworkFilter || !classFilter) return;
    
    const selectedHomework = homeworkFilter.value;
    const selectedClass = classFilter.value;
    
    // Reload submissions with filters
    loadSubmissionsWithFilters(selectedHomework, selectedClass);
}

// Load submissions with filters
async function loadSubmissionsWithFilters(homeworkId = '', classGroup = '') {
    try {
        let url = `${API_BASE_URL}/get-submissions?adminId=${currentUser.telegramId}`;
        if (homeworkId) url += `&homeworkId=${homeworkId}`;
        if (classGroup) url += `&classGroup=${classGroup}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (data.success) {
            displaySubmissions(data.submissions);
        } else {
            displaySubmissions([]);
        }
    } catch (error) {
        console.log('Error loading filtered submissions:', error);
        displaySubmissions([]);
    }
}

// Display submissions
function displaySubmissions(submissions) {
    const container = document.getElementById('submissions-list');
    if (!container) return;

    container.innerHTML = '';

    if (submissions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--tg-theme-hint-color, #666666);">Пока никто не сдал работы</p>';
        return;
    }

    submissions.forEach(submission => {
        const card = document.createElement('div');
        card.className = 'submission-card';
        
        card.innerHTML = `
            <div class="submission-header">
                <div class="submission-student">
                    <strong>${submission.studentName}</strong>
                    <span class="submission-class">${submission.class}</span>
                </div>
                <div class="submission-date">${formatDate(submission.submittedAt)}</div>
            </div>
            <div class="submission-file">
                <span class="file-icon">📎</span>
                <a href="${submission.fileUrl}" target="_blank" class="file-link">
                    Скачать файл
                </a>
            </div>
            <div class="submission-homework">
                Задание ID: ${submission.homeworkId} | Статус: ${submission.status}
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Loading modal functions
function showLoadingModal(title = 'Загрузка...', subtitle = 'Пожалуйста, подождите') {
    const modal = document.getElementById('loading-modal');
    const titleEl = document.getElementById('loading-title');
    const subtitleEl = document.getElementById('loading-subtitle');
    
    if (modal && titleEl && subtitleEl) {
        titleEl.textContent = title;
        subtitleEl.textContent = subtitle;
        modal.classList.add('show');
        modal.style.display = 'block';
        
        // Reset progress
        updateProgress(0);
    }
}

function hideLoadingModal() {
    const modal = document.getElementById('loading-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.classList.add('hide');
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('hide');
        }, 300);
    }
}

function updateLoadingText(title, subtitle) {
    const titleEl = document.getElementById('loading-title');
    const subtitleEl = document.getElementById('loading-subtitle');
    
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
}

function updateProgress(percentage) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${percentage}%`;
    }
}
