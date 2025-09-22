#!/bin/bash

# Скрипт для обновления GOOGLE_SERVICE_ACCOUNT_JSON
# Замените YOUR_REAL_JSON на ваш реальный JSON сервисного аккаунта

SITE_ID="60fe0809-8848-401d-8f0f-9675ce2cb329"
TOKEN="nfp_EMk88L8ZK9aCjoPrSEsQyZi4KhK86VUP1ca2"

# Пример команды для обновления (замените на ваш реальный JSON):
# curl -X PATCH \
#   -H "Authorization: Bearer $TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "key": "GOOGLE_SERVICE_ACCOUNT_JSON",
#     "values": [{"value": "ВАШ_РЕАЛЬНЫЙ_JSON_ЗДЕСЬ", "context": "all"}]
#   }' \
#   "https://api.netlify.com/api/v1/sites/$SITE_ID/env/GOOGLE_SERVICE_ACCOUNT_JSON"

echo "Замените YOUR_REAL_JSON на ваш реальный JSON и раскомментируйте команду curl"
