# 🚀 Инструкция по развертыванию Telegram WebApp

## 📋 Предварительные требования

1. **Telegram Bot** - создан через @BotFather
2. **Google Cloud Project** - с включенным Google Sheets API
3. **Yandex OAuth приложение** - для доступа к Яндекс.Диску
4. **Netlify аккаунт** - для хостинга приложения

## 🔧 Пошаговая настройка

### 1. Настройка Telegram Bot

```bash
# Создайте бота через @BotFather
/newbot
# Следуйте инструкциям и получите BOT_TOKEN

# Настройте WebApp кнопку
/setmenubutton
# Выберите вашего бота
# Bot Settings -> Menu Button
# Укажите URL: https://your-app.netlify.app
# Текст кнопки: "Домашка 📚"
```

### 2. Настройка Google Sheets API

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Google Sheets API:
   ```
   APIs & Services -> Library -> Google Sheets API -> Enable
   ```
4. Создайте сервисный аккаунт:
   ```
   APIs & Services -> Credentials -> Create Credentials -> Service Account
   ```
5. Скачайте JSON-ключ сервисного аккаунта
6. Создайте новую Google Sheets таблицу
7. Предоставьте доступ сервисному аккаунту к таблице (email из JSON)
8. Скопируйте ID таблицы из URL (между /d/ и /edit)

### 3. Настройка Yandex.Disk API

1. Перейдите на [Yandex OAuth](https://oauth.yandex.ru/)
2. Создайте новое приложение:
   ```
   Название: Homework App
   Платформы: Веб-сервисы
   Redirect URI: https://oauth.yandex.ru/verification_code
   Права доступа: Яндекс.Диск (чтение и запись)
   ```
3. Получите OAuth токен:
   ```bash
   # Перейдите по ссылке (замените YOUR_CLIENT_ID):
   https://oauth.yandex.ru/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://oauth.yandex.ru/verification_code&scope=cloud_api:disk.read cloud_api:disk.write
   
   # Авторизуйтесь и получите код
   # Обменяйте код на токен:
   curl -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code&code=YOUR_CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET" \
     https://oauth.yandex.ru/token
   ```

### 4. Развертывание на Netlify

1. Подключите репозиторий к Netlify
2. Настройте переменные окружения:

```bash
# В Netlify Dashboard -> Site Settings -> Environment Variables
TELEGRAM_BOT_TOKEN=your_bot_token_here
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...} # Весь JSON как строка
SPREADSHEET_ID=your_spreadsheet_id_here
YANDEX_DISK_TOKEN=your_yandex_oauth_token_here
```

3. Настройки сборки Netlify:
```toml
# netlify.toml уже настроен в проекте
[build]
  functions = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 5. Инициализация системы

После успешного развертывания:

1. **Инициализируйте Google Sheets:**
```bash
curl -X POST https://your-app.netlify.app/.netlify/functions/init-google-sheets
```

2. **Зарегистрируйте себя как администратора:**
   - Откройте `debug-api.html` на вашем сайте
   - Используйте секцию "Register Teacher"
   - Укажите ваш Telegram ID, роль "admin"

3. **Протестируйте все функции:**
   - Откройте WebApp в Telegram
   - Пройдите регистрацию как ученик
   - Добавьте тестовое задание
   - Попробуйте отправить файл

## 🔑 Важные настройки

### Обновите Admin ID в коде:

В файле `netlify/functions/google-sheets-utils.js`:
```javascript
const TELEGRAM_ADMIN_ID = 'YOUR_TELEGRAM_ID'; // Замените на ваш ID
```

В файле `netlify/functions/register-teacher.js`:
```javascript
const ADMIN_ID = 'YOUR_TELEGRAM_ID'; // Замените на ваш ID
```

### Структура Google Sheets:

После инициализации в таблице будут созданы листы:

**Students:**
- telegramId | class | lastName | firstName

**Teachers:**
- telegramId | lastName | firstName | subject | classes | role

**Homework:**
- id | class | subject | description | deadline | createdDate

**Submissions:**
- telegramId | class | homeworkId | submissionDate | fileUrl | status

## 🧪 Тестирование

### 1. Тестирование API:
```bash
# Откройте debug-api.html
https://your-app.netlify.app/debug-api.html

# Протестируйте все функции:
- Initialize Google Sheets
- Register Student
- Get User
- Add Homework
- Get Homework
- Register Teacher
```

### 2. Тестирование WebApp:
```bash
# Откройте diagnostic.html
https://your-app.netlify.app/diagnostic.html

# Проверьте:
- DOM структуру
- Навигацию между экранами
- Telegram API
```

## 🔍 Диагностика проблем

### Проблемы с Google Sheets:
- Проверьте права доступа сервисного аккаунта
- Убедитесь, что SPREADSHEET_ID корректный
- Проверьте формат GOOGLE_SERVICE_ACCOUNT_JSON

### Проблемы с Yandex.Disk:
- Проверьте срок действия OAuth токена
- Убедитесь в правах доступа (чтение и запись)
- Проверьте создание папки /Homework_App/

### Проблемы с Telegram:
- Проверьте корректность BOT_TOKEN
- Убедитесь, что WebApp URL настроен в боте
- Проверьте валидацию initData

## 📊 Мониторинг

### Логи Netlify Functions:
```bash
# В Netlify Dashboard -> Functions -> View logs
# Отслеживайте ошибки и производительность
```

### Google Sheets активность:
- Проверяйте изменения в таблице
- Отслеживайте количество записей
- Мониторьте API квоты

## 🔄 Обновления

При обновлении кода:
1. Пуш в основную ветку автоматически развернет изменения
2. Проверьте логи развертывания в Netlify
3. Протестируйте критические функции
4. Уведомите пользователей о новых возможностях

## 🛡️ Безопасность

- Регулярно обновляйте OAuth токены
- Мониторьте необычную активность в логах
- Ограничьте доступ к переменным окружения
- Регулярно проверяйте права доступа к Google Sheets

## 📞 Поддержка пользователей

Создайте инструкцию для пользователей:
1. Как зарегистрироваться
2. Как посмотреть задания
3. Как отправить домашнее задание
4. Куда обращаться при проблемах
