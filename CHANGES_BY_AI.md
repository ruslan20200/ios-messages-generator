// MODIFIED BY AI: 2026-02-12 - change log with per-file summary and sample diffs
// FILE: CHANGES_BY_AI.md

# CHANGES_BY_AI

Дата: 2026-02-12

## 1) migrations/001_create_auth_tables.sql
- Описание: добавлена SQL-миграция таблиц `users`, `sessions`, `admin_actions` + индексы.
- Пример диффа:
```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  device_id TEXT,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 2) server/db.ts
- Описание: подключение к PostgreSQL через `DATABASE_URL` (Supabase).
- Пример диффа:
```ts
export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
});
```

## 3) server/auth.ts
- Описание: JWT/пароли/cookie helpers (`bcrypt`, `jsonwebtoken`).
- Пример диффа:
```ts
export const signAuthToken = (payload: AuthPayload) => {
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
};
```

## 4) server/accessRules.ts
- Описание: бизнес-логика для `expires_at` и `device_id` привязки.
- Пример диффа:
```ts
export const evaluateDeviceAccess = (params: {
  userDeviceId: string | null;
  requestDeviceId: string;
  expiresAt: string | Date | null;
}): AccessDecision => { ... }
```

## 5) server/accessRules.test.ts
- Описание: unit-тесты core-логики device/expiry.
- Пример диффа:
```ts
it("denies login from different device", () => {
  const result = evaluateDeviceAccess({ userDeviceId: "device-A", requestDeviceId: "device-B", expiresAt: null });
  expect(result.status).toBe(403);
});
```

## 6) server/cleanupExpired.ts
- Описание: централизованная очистка просроченных аккаунтов (`deactivate`/`delete`).
- Пример диффа:
```ts
export const cleanupExpiredUsers = async (mode: CleanupMode = "deactivate") => {
  if (mode === "delete") {
    return query(`DELETE FROM users WHERE expires_at IS NOT NULL AND expires_at < NOW() RETURNING id`);
  }
};
```

## 7) server/scripts/cleanupExpiredUsers.ts
- Описание: script для ручного/cron запуска cleanup.
- Пример диффа:
```ts
const rawMode = (process.argv[2] || "deactivate").toLowerCase();
const mode: CleanupMode = rawMode === "delete" ? "delete" : "deactivate";
```

## 8) server/index.ts
- Описание: добавлены auth/admin endpoints, rate-limit, auth middleware, cookie+CORS, cleanup endpoint.
- Пример диффа:
```ts
app.post("/auth/login", loginRateLimit, async (req, res) => {
  const { login, password, deviceId } = req.body;
  ...
  const token = signAuthToken({ userId: user.id, role: user.role, deviceId, sessionId });
  res.setHeader("Set-Cookie", buildAuthCookie(token));
});
```

## 9) client/src/lib/deviceId.ts
- Описание: одноразовая генерация `deviceId` и сохранение в `localStorage`.
- Пример диффа:
```ts
const DEVICE_ID_STORAGE_KEY = "ios_msg_device_id";
export const getOrCreateDeviceId = () => { ... };
```

## 10) client/src/lib/api.ts
- Описание: единый API-клиент (`credentials: include` + bearer fallback).
- Пример диффа:
```ts
const response = await fetch(apiUrl(path), {
  ...options,
  headers,
  credentials: "include",
});
```

## 11) client/src/contexts/AuthContext.tsx
- Описание: состояние авторизации, `login/logout/refreshUser`.
- Пример диффа:
```tsx
const response = await apiRequest("/auth/login", {
  method: "POST",
  body: JSON.stringify(params),
});
```

## 12) client/src/pages/Login.tsx
- Описание: новая страница логина с отправкой `deviceId`.
- Пример диффа:
```tsx
const nextUser = await login({
  login: loginValue,
  password: passwordValue,
  deviceId,
});
```

## 13) client/src/pages/Admin.tsx
- Описание: mobile-first админ-панель (users/sessions/create/reset/delete/extend/cleanup).
- Пример диффа:
```tsx
await apiRequest(`/admin/users/${targetUserId}/reset-device`, {
  method: "POST",
  token,
});
```

## 14) client/src/App.tsx
- Описание: добавлены маршруты `/login`, `/admin` и route guards.
- Пример диффа:
```tsx
<Route path="/admin">
  {() => (
    <AuthGuard>
      <AdminGuard>
        <Admin />
      </AdminGuard>
    </AuthGuard>
  )}
</Route>
```

## 15) client/src/main.tsx
- Описание: подключен `AuthProvider`.
- Пример диффа:
```tsx
<AuthProvider>
  <App />
</AuthProvider>
```

## 16) client/src/vite-env.d.ts
- Описание: добавлены type refs для PWA virtual module.
- Пример диффа:
```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

## 17) .env.example
- Описание: добавлены env-шаблоны Supabase/JWT/CORS/cookie/rate-limit.
- Пример диффа:
```env
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
JWT_SECRET=replace-with-long-random-secret
```

## 18) render.yaml
- Описание: добавлены переменные окружения для прод-авторизации/БД.
- Пример диффа:
```yaml
- key: DATABASE_URL
  value: ""
- key: JWT_SECRET
  value: ""
```

## 19) README.md
- Описание: пошаговые инструкции для Руслана (Supabase, Express, React, тесты, deploy, curl).
- Пример диффа:
```md
## 1. Что сделать в Supabase (шаги для Руслана)
1. Открой https://supabase.com и нажми `Start your project`.
```
## 20) server/scripts/createAdminUser.ts
- Описание: script для первоначального создания/обновления первого admin-пользователя.
- Пример диффа:
```ts
pnpm tsx server/scripts/createAdminUser.ts admin admin123
```

## 21) package.json
- Описание: добавлены backend-зависимости (`pg`, `bcryptjs`, `jsonwebtoken`), типы и script `test:server`.
- Пример диффа:
```json
"test:server": "vitest run --dir server"
```

## 22) pnpm-lock.yaml
- Описание: lockfile синхронизирован после фикса зависимостей backend auth/db.
- Пример диффа:
```yaml
dependencies:
  pg:
  bcryptjs:
  jsonwebtoken:
```

## 23) client/src/contexts/AuthContext.tsx (performance update)
- Описание: добавлен локальный кэш пользователя (`USER_CACHE_KEY`) для мгновенного открытия интерфейса и фоновой валидации `/auth/me`.
- Пример диффа:
```tsx
const [user, setUser] = useState<AuthUser | null>(() => readCachedUser());
const [isLoading, setIsLoading] = useState(() => readCachedUser() === null);
```

## 24) server/index.ts (Swagger docs update)
- Описание: расширен OpenAPI для `/docs` - добавлены полные схемы request/response, все auth/admin маршруты и `bearerAuth` для кнопки `Authorize` в Swagger UI.
- Пример диффа:
```ts
components: {
  securitySchemes: {
    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
  }
}
```

## 25) client/src/pages/Admin.tsx (Onay tools)
- Описание: добавлен новый блок `Onay Tools` в админке для тестирования `POST /api/onay/sign-in` и `POST /api/onay/qr-start` прямо из интерфейса.
- Пример диффа:
```tsx
<button onClick={handleOnaySignIn}>Refresh token bundle</button>
<form onSubmit={handleOnayTerminalCheck}>...</form>
```

## 26) client/src/pages/Admin.tsx (sessions refresh)
- Описание: добавлена кнопка `Refresh` в секции `Sessions and login logs`, отдельное состояние загрузки и отметка времени последнего обновления без перезагрузки всей страницы.
- Пример диффа:
```tsx
<button onClick={refreshSessions}>Refresh</button>
<div>Last update: {sessionsUpdatedAt?.toLocaleTimeString()}</div>
```

## 27) client/src/pages/Login.tsx (UI simplification)
- Описание: упрощён экран входа: убраны лишние текстовые блоки, заголовок `Login` по центру, placeholder для логина изменён на `name`, добавлен глазок показать/скрыть пароль.
- Пример диффа:
```tsx
<input placeholder="name" />
<button type="button">{showPassword ? <EyeOff /> : <Eye />}</button>
```

## 28) client/src/pages/Admin.tsx (elastic iOS redesign)
- Описание: обновлён визуальный стиль админки под iOS (glassmorphism/градиенты), улучшена адаптивность mobile-first, добавлены плавные анимации появления секций и карточек через `framer-motion`, усилены touch-friendly контролы.
- Пример диффа:
```tsx
import { AnimatePresence, motion } from "framer-motion";
<motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} />
```

## 29) client/src/pages/Admin.tsx (auto-refresh + skeletons + swipe actions)
- Описание: добавлены skeleton-заглушки для users/sessions, автообновление сессий каждые 15 секунд с паузой при неактивной вкладке, и swipe-left быстрые действия на карточках пользователей для iOS (mobile).
- Пример диффа:
```tsx
const timer = window.setInterval(() => {
  void refreshSessions({ silent: true });
}, 15000);

<motion.div animate={{ x: swipedUserId === entry.id ? -176 : 0 }} />
```

## 30) client/src/pages/Home.tsx (elastic iOS redesign)
- Description: Home screen updated to the same glass/gradient visual language as admin, with smooth card motion, clearer API/manual split, and touch-friendly controls.
- Date: 2026-02-12
- Diff sample:
```tsx
const glassCardClass = "rounded-3xl border border-white/12 bg-[#0f1016]/82 backdrop-blur-xl ...";
<motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} />
```

## 31) client/src/pages/Login.tsx (visual consistency + smooth motion)
- Description: Login page aligned with the same iOS elastic style, kept centered layout, preserved `name` placeholder and added smoother transitions while keeping auth flow unchanged.
- Date: 2026-02-12
- Diff sample:
```tsx
import { motion } from "framer-motion";
<form onSubmit={onSubmit} className={`${glassCardClass} space-y-4 p-4`}>
```

## 32) client/src/pages/Chat.tsx (keyboard-safe composer on mobile)
- Description: Implemented `visualViewport`-based keyboard detection and dynamic bottom offset so message input stays visible above mobile keyboards (iOS/Android), with auto-scroll stabilization.
- Date: 2026-02-12
- Diff sample:
```tsx
const [keyboardOffset, setKeyboardOffset] = useState(0);
style={{ bottom: keyboardOffset }}
paddingBottom: composerHeight + keyboardOffset + 16,
```

## 33) client/src/pages/Chat.tsx (style rollback + keyboard fix only)
- Description: Reverted chat UI visuals to previous style; kept only mobile keyboard-safe behavior so input stays above virtual keyboard.
- Date: 2026-02-12
- Diff sample:
```tsx
<div className="fixed left-0 right-0 safe-area-bottom z-50" style={{ bottom: keyboardOffset }}>
...
paddingBottom: 140 + keyboardOffset,
```

## 34) client/src/pages/Chat.tsx + server/index.ts (digits-only terminal validation)
- Description: Chat API mode now allows/sends only digits for terminal code; server endpoint `/api/onay/qr-start` also enforces digits-only and returns `400` for invalid payload.
- Date: 2026-02-12
- Diff sample:
```tsx
const TERMINAL_DIGITS_PATTERN = /^\d+$/;
inputMode={mode === "api" ? "numeric" : "text"}
```
```ts
if (!terminalDigitsPattern.test(terminal)) {
  return res.status(400).json({ success: false, message: "terminal must contain digits only" });
}
```

## 35) client/src/pages/Home.tsx (Russian localization + action hints)
- Description: Localized Home page labels/buttons/toasts to Russian and added explicit guidance text for where to click in API vs manual mode.
- Date: 2026-02-12
- Diff sample:
```tsx
<h1 className="text-3xl font-bold tracking-tight">Сообщения</h1>
<p className="text-xs text-gray-500">Для API нажмите «Открыть», для ручного режима нажмите «В чат».</p>
```

## 36) client/src/pages/Chat.tsx + client/src/components/MessageBubble.tsx (iMessage-like chat UI)
- Description: Chat composer redesigned to iMessage-like layout (left plus, "Тема" row, divider, "Текстовое сообщение • SMS" input) and mic icon now switches to green send button when input has digits/text; message bubbles restyled with rounded tails, from-bottom animation, and white underline on sent bubble text.
- Date: 2026-02-12
- Diff sample:
```tsx
{canSend ? <ArrowUp ... /> : <Mic ... />}
<div className="text-[20px] font-semibold text-[#9ea0a9]">Тема</div>
```
```tsx
const isSentCode = isMe && /^\d+$/.test(text.trim()) && text.trim().length <= 8;
className={cn(isMe && "underline decoration-2 underline-offset-4 decoration-white/95")}
```

## 37) client/src/pages/Chat.tsx + client/src/components/MessageBubble.tsx (size tuning for adaptive match)
- Description: Reduced chat element scale to better match reference (smaller bubbles/code text/composer controls), added responsive `clamp()` sizing, increased top message offset under header, and tightened bottom composer proportions for mobile adaptivity.
- Date: 2026-02-12
- Diff sample:
```tsx
className="flex-1 overflow-y-auto px-4 pt-[156px] ..."
paddingBottom: 166 + keyboardOffset,
```
```tsx
const sentCodeSizeClass = codeLength <= 5
  ? "text-[clamp(34px,10.8vw,46px)]"
  : ...
```

## 38) client/src/pages/Chat.tsx + client/src/components/MessageBubble.tsx (further size reduction)
- Description: Reduced chat UI scale again (bubbles/code font/composer/button sizes and spacing) to align closer to reference screenshots while keeping full adaptivity.
- Date: 2026-02-12
- Diff sample:
```tsx
isSentCode ? "max-w-[70%] px-3.5 py-2" : "max-w-[76%] px-3.5 py-2.5"
paddingBottom: 144 + keyboardOffset,
```

## 39) client/src/pages/Chat.tsx + client/src/components/MessageBubble.tsx (extra shrink and right-gap reduction)
- Description: Further reduced sent code bubble/font size, compacted bottom composer controls and paddings, and reduced list side padding so right-side outgoing bubble sits closer to the edge.
- Date: 2026-02-12
- Diff sample:
```tsx
isSentCode ? "max-w-[66%] px-3 py-1.5" : "max-w-[74%] ..."
className="flex-1 overflow-y-auto px-2.5 pt-[148px] ..."
```

## 40) server/accessRules.ts + server/index.ts + server/accessRules.test.ts (admin multi-device login)
- Description: Removed single-device restriction for `admin` while preserving expiry checks and keeping one-device enforcement for regular `user` accounts.
- Date: 2026-02-12
- Diff sample:
```ts
if (params.role === "admin") {
  return { ok: true, shouldBindDevice: false, status: 200 };
}
```
```ts
if (session.role !== "admin" && session.device_id && session.device_id !== payload.deviceId) {
  return res.status(403).json({ success: false, error: DEVICE_IN_USE_MESSAGE });
}
```

## 41) client/src/pages/Admin.tsx (show/hide password in create-user form)
- Description: Added password visibility toggle in the admin "Create user" form, matching login behavior (eye icon to show/hide password).
- Date: 2026-02-12
- Diff sample:
```tsx
const [showCreatePassword, setShowCreatePassword] = useState(false);
<input type={showCreatePassword ? "text" : "password"} ... />
{showCreatePassword ? <EyeOff size={18} /> : <Eye size={18} />}
```

## 42) server/index.ts + client/src/pages/Admin.tsx (delete session from admin panel)
- Description: Added `DELETE /admin/sessions/:id` for admins and a `Delete` button in each session card so old/duplicate session logs can be removed without full user deletion.
- Date: 2026-02-12
- Diff sample:
```ts
app.delete("/admin/sessions/:id", requireAuth, requireAdmin, async (req, res) => {
  const deleted = await query(`DELETE FROM sessions WHERE id = $1 RETURNING id, user_id`, [sessionId]);
});
```
```tsx
await apiRequest(`/admin/sessions/${sessionId}`, { method: "DELETE", token });
<button onClick={() => void deleteSession(session.id)}>Delete</button>
```

## 43) server/onayClient.ts + server/index.ts + client/src/pages/Chat.tsx + client/src/pages/Home.tsx (Onay performance optimization)
- Description: Optimized Onay flow for faster Render responses: added HTTP keep-alive, PAN caching with TTL, in-flight request dedupe, optional boot warmup, and reduced client retry/backoff delays with per-attempt timeout.
- Date: 2026-02-12
- Diff sample:
```ts
this.http = axios.create({ timeout: config.requestTimeoutMs, httpsAgent });
const cachedPan = this.readCachedPan();
if (cachedPan) return cachedPan;
```
```ts
const onayWarmupOnBoot = process.env.ONAY_WARMUP_ON_BOOT === "true";
res.setHeader("X-Onay-Latency-Ms", String(Date.now() - startedAt));
```
```tsx
async function fetchWithRetry(path, init, attempts = 2, delayMs = 800, timeoutMs = 12000) { ... }
```

## 44) client/src/lib/api.ts + client/src/pages/Admin.tsx (Onay latency monitor in admin)
- Description: Added response metadata support in API client and implemented live Onay latency monitor in admin panel (last latency, average latency, sample count, endpoint and update time) from `X-Onay-Latency-Ms` header.
- Date: 2026-02-12
- Diff sample:
```ts
export async function apiRequestWithMeta<T>(...) {
  return { data, headers: response.headers, status: response.status };
}
```
```tsx
recordOnayLatency(response.headers, "qr-start");
{onayLastLatencyMs !== null ? `${onayLastLatencyMs} ms` : "-"}
```

## 45) server/index.ts (fix FK warning in delete_user admin log)
- Description: Fixed admin action logging after user deletion to prevent `admin_actions_target_user_id_fkey` violation: `target_user_id` is now `NULL` and deleted id is preserved in `notes`.
- Date: 2026-02-12
- Diff sample:
```ts
action: "delete_user",
targetUserId: null,
notes: `deleted_user_id=${userId}`,
```
