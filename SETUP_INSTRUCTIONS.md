# 🚀 Инструкции по настройке после развертывания

## ⚠️ ВАЖНО: Обязательные шаги перед использованием

### 1. Обновите Admin ID в коде

Найдите и замените ваш реальный Telegram ID в следующих файлах:

**netlify/functions/google-sheets-utils.js (строка 160):**
```javascript
const TELEGRAM_ADMIN_ID = 'ВАШ_TELEGRAM_ID'; // Замените 330977942 на ваш ID
```

**netlify/functions/register-teacher.js (строка 7):**
```javascript
const ADMIN_ID = 'ВАШ_TELEGRAM_ID'; // Замените 330977942 на ваш ID
```

### 2. Настройте переменные окружения в Netlify

Перейдите в Netlify Dashboard → Site Settings → Environment Variables:

```bash
TELEGRAM_BOT_TOKEN=ваш_токен_бота_от_botfather
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}  # Весь JSON файл
SPREADSHEET_ID=1ABC...XYZ  # ID из URL Google Sheets
YANDEX_DISK_TOKEN=y0_AgA...  # OAuth токен Яндекс.Диска
```

### 3. Получите ваш Telegram ID

Если не знаете свой Telegram ID:
1. Напишите боту @userinfobot
2. Он пришлет ваш ID
3. Используйте этот ID в коде выше

### 4. После развертывания выполните инициализацию

```bash
curl -X POST https://ваш-сайт.netlify.app/.netlify/functions/init-google-sheets
```

### 5. Зарегистрируйте себя как администратора

1. Откройте https://ваш-сайт.netlify.app/debug-api.html
2. В секции "Register Teacher" укажите:
   - Teacher Telegram ID: ваш ID
   - Role: admin
   - Admin ID: ваш ID (тот же)
3. Нажмите "Register Teacher"

## 🧪 Тестирование

После настройки протестируйте:
1. Откройте WebApp в Telegram
2. Пройдите регистрацию как ученик
3. Добавьте тестовое задание (должна появиться кнопка админа)
4. Попробуйте отправить файл

## 📞 Если что-то не работает

1. Проверьте логи в Netlify Functions
2. Убедитесь, что все переменные окружения настроены
3. Проверьте права доступа к Google Sheets
4. Убедитесь, что Yandex OAuth токен действителен
