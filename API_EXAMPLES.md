# 📚 Примеры использования API

## 🎯 Основные сценарии использования

### 1. Регистрация ученика

```javascript
// POST /register-student
const registerStudent = async (telegramId, classGroup, lastName, firstName, initData) => {
    const response = await fetch('/.netlify/functions/register-student', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            telegramId,
            class: classGroup,
            lastName,
            firstName,
            initData
        })
    });
    
    const result = await response.json();
    return result;
};

// Пример использования:
const result = await registerStudent('123456789', '8Б', 'Иванов', 'Иван', tg.initData);
console.log(result);
// { success: true, message: "Student registered successfully", isNew: true, student: {...} }
```

### 2. Получение данных пользователя

```javascript
// GET /get-user
const getUser = async (telegramId) => {
    const response = await fetch(`/.netlify/functions/get-user?telegramId=${telegramId}`);
    const result = await response.json();
    return result;
};

// Пример использования:
const user = await getUser('123456789');
if (user.success) {
    console.log('Пользователь найден:', user.user);
    // { telegramId: "123456789", class: "8Б", lastName: "Иванов", firstName: "Иван", isStudent: true }
} else {
    console.log('Пользователь не найден');
}
```

### 3. Добавление домашнего задания (учителя/админы)

```javascript
// POST /add-homework
const addHomework = async (adminId, classGroup, subject, description, deadline, initData) => {
    const response = await fetch('/.netlify/functions/add-homework', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            adminId,
            class: classGroup,
            subject,
            description,
            deadline,
            initData
        })
    });
    
    const result = await response.json();
    return result;
};

// Пример использования:
const homework = await addHomework(
    '330977942', // ID учителя/админа
    '8Б',
    'Информатика',
    'Создать веб-страницу с использованием HTML и CSS',
    '2024-02-15',
    tg.initData
);
console.log(homework);
// { success: true, message: "Домашнее задание успешно добавлено", homeworkId: "1234567890", homework: {...} }
```

### 4. Получение списка заданий

```javascript
// GET /get-homework
const getHomework = async (classGroup) => {
    const response = await fetch(`/.netlify/functions/get-homework?class=${classGroup}`);
    const result = await response.json();
    return result;
};

// Пример использования:
const assignments = await getHomework('8Б');
if (assignments.success) {
    assignments.homework.forEach(hw => {
        console.log(`${hw.subject}: ${hw.description} (до ${hw.deadline})`);
    });
}
```

### 5. Отправка выполненного задания

```javascript
// POST /submit-homework-sheets
const submitHomework = async (telegramId, homeworkId, fileData, initData) => {
    const response = await fetch('/.netlify/functions/submit-homework-sheets', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            telegramId,
            homeworkId,
            fileData,
            initData
        })
    });
    
    const result = await response.json();
    return result;
};

// Подготовка файла
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

// Пример использования:
const fileInput = document.getElementById('homework-file');
const file = fileInput.files[0];
const fileContent = await fileToBase64(file);

const fileData = {
    fileName: file.name,
    fileContent: fileContent,
    fileType: file.type
};

const submission = await submitHomework('123456789', '1234567890', fileData, tg.initData);
console.log(submission);
// { success: true, message: "Homework submitted successfully", fileUrl: "https://...", submission: {...} }
```

### 6. Регистрация учителя (только админы)

```javascript
// POST /register-teacher
const registerTeacher = async (teacherData, adminId) => {
    const response = await fetch('/.netlify/functions/register-teacher', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            telegramId: teacherData.telegramId,
            lastName: teacherData.lastName,
            firstName: teacherData.firstName,
            subject: teacherData.subject,
            classes: teacherData.classes, // массив классов
            role: teacherData.role, // 'teacher' или 'admin'
            adminId: adminId
        })
    });
    
    const result = await response.json();
    return result;
};

// Пример использования:
const teacherData = {
    telegramId: '987654321',
    lastName: 'Петрова',
    firstName: 'Мария',
    subject: 'Математика',
    classes: ['8А', '8Б', '9А'],
    role: 'teacher'
};

const teacher = await registerTeacher(teacherData, '330977942');
console.log(teacher);
// { success: true, message: "Teacher registered successfully", isNew: true, teacher: {...} }
```

## 🔧 Утилитарные функции

### Инициализация Google Sheets

```javascript
// POST /init-google-sheets
const initializeSheets = async () => {
    const response = await fetch('/.netlify/functions/init-google-sheets', {
        method: 'POST'
    });
    
    const result = await response.json();
    return result;
};

// Использование:
const init = await initializeSheets();
console.log(init);
// { success: true, message: "Google Sheets initialized successfully", sheets: [...], missingSheets: [...] }
```

## 🎨 Интеграция с фронтендом

### Проверка авторизации пользователя

```javascript
const checkUserAuth = async () => {
    if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) {
        showError('Ошибка инициализации Telegram');
        return null;
    }
    
    const telegramId = tg.initDataUnsafe.user.id;
    const user = await getUser(telegramId);
    
    if (user.success) {
        return user.user;
    } else {
        return null; // Пользователь не зарегистрирован
    }
};
```

### Загрузка и отображение заданий

```javascript
const loadAndDisplayHomework = async (userClass) => {
    try {
        const assignments = await getHomework(userClass);
        
        if (assignments.success) {
            const container = document.getElementById('assignments-list');
            container.innerHTML = '';
            
            assignments.homework.forEach(hw => {
                const card = document.createElement('div');
                card.className = 'assignment-card';
                card.innerHTML = `
                    <div class="assignment-date">${formatDate(hw.deadline)}</div>
                    <div class="assignment-topic">${hw.subject}</div>
                    <div class="assignment-description">${hw.description}</div>
                `;
                container.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки заданий:', error);
    }
};
```

### Обработка отправки файла

```javascript
const handleFileSubmission = async (event) => {
    event.preventDefault();
    
    const fileInput = document.getElementById('homework-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Пожалуйста, выберите файл');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
        alert('Размер файла не должен превышать 10MB');
        return;
    }
    
    try {
        const fileContent = await fileToBase64(file);
        const fileData = {
            fileName: file.name,
            fileContent: fileContent,
            fileType: file.type
        };
        
        const result = await submitHomework(
            tg.initDataUnsafe.user.id,
            '1', // ID задания
            fileData,
            tg.initData
        );
        
        if (result.success) {
            alert('Задание успешно отправлено!');
            fileInput.value = '';
        } else {
            alert('Ошибка: ' + result.message);
        }
    } catch (error) {
        console.error('Ошибка отправки файла:', error);
        alert('Произошла ошибка при отправке файла');
    }
};
```

## 🔒 Обработка ошибок

### Стандартная обработка ответов API

```javascript
const handleApiResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.message || 'API returned unsuccessful response');
    }
    
    return data;
};

// Использование:
try {
    const response = await fetch('/.netlify/functions/get-user?telegramId=123');
    const result = await handleApiResponse(response);
    console.log('Успех:', result);
} catch (error) {
    console.error('Ошибка API:', error.message);
    showUserError(error.message);
}
```

### Валидация данных Telegram

```javascript
const validateTelegramUser = () => {
    if (!window.Telegram || !window.Telegram.WebApp) {
        throw new Error('Telegram WebApp не доступен');
    }
    
    const tg = window.Telegram.WebApp;
    
    if (!tg.initDataUnsafe || !tg.initDataUnsafe.user) {
        throw new Error('Данные пользователя Telegram недоступны');
    }
    
    return tg;
};
```

## 📊 Мониторинг и аналитика

### Логирование действий пользователя

```javascript
const logUserAction = (action, data = {}) => {
    console.log(`[${new Date().toISOString()}] ${action}:`, data);
    
    // Отправка в аналитику (опционально)
    if (window.gtag) {
        gtag('event', action, {
            custom_parameter: JSON.stringify(data)
        });
    }
};

// Использование:
logUserAction('homework_submitted', { 
    userId: tg.initDataUnsafe.user.id, 
    fileName: file.name 
});
```

## 🎯 Типичные сценарии использования

### Полный цикл работы ученика

```javascript
const studentWorkflow = async () => {
    try {
        // 1. Проверка авторизации
        const user = await checkUserAuth();
        
        if (!user) {
            // 2. Регистрация если нужно
            showRegistrationForm();
            return;
        }
        
        // 3. Загрузка заданий
        await loadAndDisplayHomework(user.class);
        
        // 4. Показ главного меню
        showMainMenu(user);
        
    } catch (error) {
        console.error('Ошибка в workflow ученика:', error);
        showError('Произошла ошибка. Попробуйте позже.');
    }
};
```

### Полный цикл работы учителя

```javascript
const teacherWorkflow = async () => {
    try {
        const user = await checkUserAuth();
        
        if (!user || !user.isTeacher) {
            showError('Доступ запрещен');
            return;
        }
        
        // Загрузка заданий для всех классов учителя
        const allAssignments = [];
        for (const classGroup of user.classes) {
            const assignments = await getHomework(classGroup);
            if (assignments.success) {
                allAssignments.push(...assignments.homework);
            }
        }
        
        displayTeacherDashboard(user, allAssignments);
        
    } catch (error) {
        console.error('Ошибка в workflow учителя:', error);
        showError('Произошла ошибка. Попробуйте позже.');
    }
};
```
