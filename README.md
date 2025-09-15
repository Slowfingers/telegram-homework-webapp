# Homework Teacher WebApp

Мини-веб-приложение учителя информатики для управления домашними заданиями через Telegram WebApp.

## Функционал

### 🔐 Авторизация
- Автоматическое считывание данных пользователя из Telegram
- Проверка регистрации по `user.id`
- Форма регистрации с выбором класса и вводом ФИО

### 📚 Просмотр заданий
- Список домашних заданий с фильтрацией по классу
- Разделение на актуальные задания и архив
- Отображение даты, темы и описания задания

### 📝 Сдача работ
- Загрузка файлов с домашними заданиями
- Автоматическая организация файлов по классам
- Сохранение метаданных о сдаче работ

## Технические особенности

### Безопасность
- Валидация данных Telegram через hash и auth_date
- Скрытые таблицы данных (доступ только через API)
- Минимальные права доступа к Yandex API

### Интеграция
- **Telegram WebApp API** - для получения данных пользователя
- **Yandex Disk API** - для хранения файлов
- **Yandex Tables** - для хранения данных пользователей и заданий
- **Netlify Functions** - серверная логика

## Настройка окружения

Необходимо установить следующие переменные окружения в Netlify:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
YANDEX_OAUTH_TOKEN=your_yandex_oauth_token_here
YANDEX_SPREADSHEET_ID=your_spreadsheet_id_here
```

### Получение Yandex OAuth токена

У вас уже есть OAuth приложение с данными:
- **Client ID**: `79cc733111fa4473b5c68c93eb8b1887`
- **Client Secret**: `6885a7f18d7e4f5d8ff74bc20f48d0af`

Для получения OAuth токена:

1. Перейдите по ссылке для авторизации:
   ```
   https://oauth.yandex.ru/authorize?response_type=code&client_id=79cc733111fa4473b5c68c93eb8b1887&redirect_uri=https://oauth.yandex.ru/verification_code&scope=cloud_api:disk.read cloud_api:disk.write
   ```

2. Авторизуйтесь и получите код подтверждения

3. Обменяйте код на токен:
   ```bash
   curl -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code&code=YOUR_CODE&client_id=79cc733111fa4473b5c68c93eb8b1887&client_secret=6885a7f18d7e4f5d8ff74bc20f48d0af" \
     https://oauth.yandex.ru/token
   ```

4. Полученный `access_token` используйте как `YANDEX_OAUTH_TOKEN`

## Структура проекта

```
├── index.html              # Главная страница WebApp
├── styles.css              # Стили приложения
├── app.js                  # Клиентская логика
├── package.json            # Зависимости Node.js
├── netlify.toml           # Конфигурация Netlify
├── netlify/functions/     # Серверные функции
│   ├── check-user.js      # Проверка регистрации пользователя
│   ├── register-user.js   # Регистрация нового пользователя
│   ├── get-assignments.js # Получение списка заданий
│   └── submit-homework.js # Сдача домашнего задания
└── README.md              # Документация
```

## Развертывание

### Автоматическое развертывание через Netlify

1. Подключите репозиторий к Netlify
2. Установите переменные окружения
3. Netlify автоматически развернет приложение

### Ручное развертывание

```bash
# Установка зависимостей
npm install

# Локальная разработка
npm run dev

# Развертывание (выполняется автоматически в Netlify)
npm run build
```

## Настройка Telegram Bot

1. Создайте бота через @BotFather
2. Получите токен бота
3. Настройте WebApp в боте:
   ```
   /setmenubutton
   /mybots -> [выберите бота] -> Bot Settings -> Menu Button
   ```
4. Укажите URL вашего Netlify приложения

## Настройка Yandex API

### Yandex Disk API
1. Создайте приложение в Yandex OAuth
2. Получите OAuth токен с правами на Yandex Disk
3. Создайте папку `/Homework_App` в корне диска

### Структура папок в Yandex Disk
```
/Homework_App/
├── roster_[telegramId].txt    # Данные пользователей
├── Records/                   # Записи о сдаче работ
│   └── submission_*.txt
└── Submissions/               # Файлы домашних заданий
    ├── 5А/
    ├── 5Б/
    └── ...
```

## Использование

1. Пользователь открывает WebApp через Telegram
2. При первом входе заполняет форму регистрации
3. В главном меню выбирает нужное действие:
   - **Узнать ДЗ** - просмотр актуальных и архивных заданий
   - **Сдать ДЗ** - загрузка файла с выполненным заданием

## Поддерживаемые форматы файлов

- PDF (.pdf)
- Microsoft Word (.doc, .docx)
- Текстовые файлы (.txt)
- Изображения (.jpg, .jpeg, .png)

Максимальный размер файла: 10 МБ

## Лицензия

MIT License
