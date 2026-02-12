  // MODIFIED BY AI: 2026-02-12 - documented Supabase setup, migrations, auth/admin API, deploy and manual QA flow
// FILE: README.md

# iOS Messages Generator + Auth/Admin (Supabase)

Проект: frontend на React + Vite и backend на Express.

В этой версии добавлены:
- авторизация `/auth/login` с привязкой `deviceId`;
- роли `admin/user`;
- админ API для управления пользователями, сроками доступа и сессиями;
- SQL миграция для Supabase PostgreSQL;
- mobile-first админ-панель и страница логина.

## 1. Что сделать в Supabase (шаги для Руслана)

1. Открой https://supabase.com и нажми `Start your project`.
2. Нажми `New project`.
3. Выбери Organization.
4. Заполни:
- `Name` (например `ios-messages-generator`)
- `Database Password` (сохрани отдельно)
- `Region` (ближайший)
5. Нажми `Create new project` и дождись статуса `Healthy`.
6. В левом меню открой `Project Settings` -> `Database`.
7. Пролистай до блока `Connection string`.
8. Выбери режим `URI` и скопируй строку вида:
`postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres`
9. В этой строке замени `<password>` на реальный пароль БД.
10. Сохрани как `DATABASE_URL` в backend env.

## 2. Что сделать в Express

1. Создай `.env` на основе `.env.example`.
2. Заполни минимум:
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `AUTH_COOKIE_SECURE` (`false` локально, `true` в проде HTTPS)
3. Запусти API:
```bash
pnpm dev:api
```
4. Прогони миграцию через Supabase SQL Editor:
- Открой `SQL Editor` -> `New query`
- Вставь SQL из `migrations/001_create_auth_tables.sql`
- Нажми `Run`

Альтернатива через `psql`:
```bash
psql "$DATABASE_URL" -f migrations/001_create_auth_tables.sql
```

## 3. Что сделать в React

1. Запусти клиент:
```bash
pnpm dev
```
2. На странице `/login` генерируется `deviceId` и сохраняется в `localStorage`.
3. При логине отправляется `{ login, password, deviceId }`.
4. Токен хранится в httpOnly cookie (по умолчанию, безопаснее).
5. Fallback (менее безопасный):
- `VITE_USE_TOKEN_FALLBACK=true`
- тогда токен дублируется в `localStorage`.

## 4. Миграции

Основная миграция: `migrations/001_create_auth_tables.sql`

Создаёт таблицы:
- `users`
- `sessions`
- `admin_actions`

В `users.expires_at`:
- `NULL` = бессрочный доступ;
- дата в прошлом = вход блокируется (`410`).

## 5. Новые API

### Auth
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

### Admin (только `role=admin`)
- `POST /admin/users`
- `GET /admin/users`
- `POST /admin/users/:id/reset-device`
- `DELETE /admin/users/:id`
- `POST /admin/users/:id/extend`
- `GET /admin/sessions`
- `POST /admin/cleanup-expired`

## 6. Примеры curl

Логин:
```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin123","deviceId":"phone-A-uuid"}'
```

Создать пользователя (admin token):
```bash
curl -X POST http://localhost:3000/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{"login":"user1","password":"pass12345","role":"user","expires_at":null}'
```

Сбросить устройство:
```bash
curl -X POST http://localhost:3000/admin/users/2/reset-device \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Продлить на 3 месяца:
```bash
curl -X POST http://localhost:3000/admin/users/2/extend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{"months":3}'
```

Очистка просроченных:
```bash
curl -X POST http://localhost:3000/admin/cleanup-expired \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{"mode":"deactivate"}'
```

## 7. Ручное тестирование (сценарий)

1. Админ создаёт пользователя в `/admin`.
2. Логин на телефоне A (`deviceId=A`) -> успешно.
3. Логин того же пользователя на телефоне B (`deviceId=B`) -> ошибка
`Этот аккаунт уже используется на другом устройстве`.
4. Админ нажимает `Reset Device`.
5. Повторный логин на телефоне B -> успешно.

## 8. Cleanup по cron

Ручной запуск скрипта:
```bash
pnpm tsx server/scripts/cleanupExpiredUsers.ts deactivate
pnpm tsx server/scripts/cleanupExpiredUsers.ts delete
```

Пример cron (Linux, каждый день в 02:30):
```cron
30 2 * * * cd /path/to/repo && pnpm tsx server/scripts/cleanupExpiredUsers.ts deactivate >> cleanup.log 2>&1
```

## 9. Деплой (env vars)

Обязательные серверные переменные:
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAME_SITE`
- `PUBLIC_BASE_URL`

Для текущего Onay функционала дополнительно:
- `ONAY_APP_TOKEN`
- `ONAY_DEVICE_ID`
- `ONAY_PHONE_NUMBER`
- `ONAY_PASSWORD`
- `ONAY_PUSH_TOKEN`

## 10. Безопасность

- Пароли хранятся только как `bcrypt` хэш.
- Логин ограничен rate-limit (IP-based in-memory limiter).
- Для продакшена выставляй cookie только с `Secure` на HTTPS.
- Если используешь fallback token в `localStorage`, учитывай риск XSS.

## 11. Bootstrap first admin

Если база пустая и в системе нет администратора, создай первого админа скриптом:
```bash
pnpm tsx server/scripts/createAdminUser.ts admin admin123
```
