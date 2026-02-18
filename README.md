# iOS Messages Generator

Мобильное веб-приложение (PWA) для генерации сообщений в стиле iMessage, работы с QR, авторизации пользователей и админ-управления доступом.

## Что умеет приложение

- Авторизация по логину/паролю + привязка к устройству (`deviceId`)
- Роли пользователей: `admin` / `user`
- Чат в двух режимах:
  - API-режим (запрос в Onay)
  - Manual-режим (локальная генерация сообщения)
- Сканер QR по кнопке `+` в чате:
  - авто-распознавание через `BarcodeDetector`
  - fallback через `jsQR`
- Контекстное меню сообщений по long-press:
  - `Скопировать`
  - `Удалить`
- Страница QR-билета: QR содержит **сам код проверки** (не ссылку)
- PWA: установка на главный экран, офлайн-базовая работа, кэширование ассетов
- Админ-панель:
  - создание/удаление пользователей
  - сброс привязки устройства
  - продление доступа
  - управление сессиями

---

## Стек

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- Radix UI
- Wouter (роутинг)
- Framer Motion

### Backend
- Node.js + Express + TypeScript (`tsx`)
- PostgreSQL (Supabase)
- JWT + cookie auth
- `bcryptjs` для паролей

---

## Структура проекта

- `client/` — фронтенд
- `server/` — backend API
- `shared/` — общие типы/константы
- `migrations/` — SQL-миграции

Ключевые файлы:
- `client/src/pages/Chat.tsx` — основной чат + composer + сканер/меню сообщений
- `client/src/components/QrScannerSheet.tsx` — камера и распознавание QR
- `client/src/pages/QrPage.tsx` — экран QR-билета
- `client/src/contexts/AuthContext.tsx` — auth-состояние
- `client/src/contexts/ChatContext.tsx` — manual-чат/история
- `server/index.ts` — маршруты API
- `migrations/001_create_auth_tables.sql` — базовая схема БД

---

## Быстрый старт (локально)

## 1) Установить зависимости

```bash
pnpm install
```

## 2) Подготовить `.env`

Минимально нужны:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `AUTH_COOKIE_SECURE`

Дополнительно для Onay/API-функций — переменные `ONAY_*`.

## 3) Применить миграцию

Через Supabase SQL Editor запусти:

- `migrations/001_create_auth_tables.sql`

или через `psql`:

```bash
psql "$DATABASE_URL" -f migrations/001_create_auth_tables.sql
```

## 4) Запустить backend

```bash
pnpm dev:api
```

## 5) Запустить frontend

```bash
pnpm dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3000`

---

## Команды

```bash
pnpm dev          # frontend (Vite)
pnpm dev:api      # backend (Express)
pnpm check        # TypeScript typecheck
pnpm test:server  # server tests
pnpm build        # production build (client + server bundle)
```

---

## Auth и роли

### Основные эндпоинты

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

### Админ-эндпоинты

- `POST /admin/users`
- `GET /admin/users`
- `POST /admin/users/:id/reset-device`
- `DELETE /admin/users/:id`
- `POST /admin/users/:id/extend`
- `GET /admin/sessions`
- `POST /admin/cleanup-expired`

---

## Работа QR и чата

## QR-сканер в чате

- Кнопка `+` открывает camera sheet
- После успешного сканирования terminal ID подставляется в поле ввода
- Поддерживаются ошибки:
  - нет доступа к камере
  - QR не распознан
  - неверный формат

## Формат распознаваемого QR для terminal

Ожидается:

```text
http://c.onay.kz/{TERMINAL_ID}
```

## QR на странице билета

На странице `/qr/:code` QR кодирует **сам `code`** (например `959E2`), чтобы сканер показывал код напрямую.

---

## PWA и производительность

Сделано для быстрого старта на слабом интернете:

- lazy loading страниц
- smart prefetch только нужных роутов (`Login`, `Chat`) в idle
- неблокирующий bootstrap auth
- оптимизированная запись истории сообщений (dedupe + idle write)
- runtime caching для страниц и ассетов
- boot-shell до инициализации React

---

## Камера: почему иногда просит доступ снова

Браузер запоминает разрешение по домену.

Если используешь `ngrok` с новым URL каждый раз, доступ к камере будет спрашиваться снова.

Рекомендации:
- использовать постоянный домен (reserved domain / собственный домен)
- в Safari для сайта включить Camera = Allow

---

## Деплой

Поддерживаются варианты через:
- Netlify (`netlify.toml`)
- Render (`render.yaml`)

Важно:
- backend и frontend должны иметь корректные env
- `CORS_ORIGIN` должен содержать ваш frontend-домен
- в production включить безопасные cookie-настройки (`AUTH_COOKIE_SECURE=true`)

---

## Troubleshooting

### `POST /auth/login` возвращает 404 на `:5173`

Причина: запрос ушёл в Vite вместо API.

Проверь dev proxy в `vite.config.ts` и путь запроса.

### `pnpm dev:api` -> `EADDRINUSE: 3000`

Порт уже занят другим процессом. Останови текущий процесс или используй другой порт.

### QR-сканер на iPhone нестабилен

Проверь:
- HTTPS-домен
- разрешение камеры в Safari
- открытие именно через тот же домен, где выдавали permission

---

## Безопасность

- Пароли хранятся как bcrypt hash
- JWT в cookie + серверная проверка сессии
- rate-limit на логин
- device-binding для user-аккаунтов

---

## Лицензия

Внутренний проект. Использование и распространение по договорённости владельца репозитория.
