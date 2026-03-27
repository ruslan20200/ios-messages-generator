// MODIFIED BY AI: 2026-02-12 - change log with per-file summary and sample diffs
// FILE: CHANGES_BY_AI.md

# CHANGES_BY_AI

Р”Р°С‚Р°: 2026-02-12

## 1) migrations/001_create_auth_tables.sql
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅР° SQL-РјРёРіСЂР°С†РёСЏ С‚Р°Р±Р»РёС† `users`, `sessions`, `admin_actions` + РёРЅРґРµРєСЃС‹.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
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
- РћРїРёСЃР°РЅРёРµ: РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє PostgreSQL С‡РµСЂРµР· `DATABASE_URL` (Supabase).
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
});
```

## 3) server/auth.ts
- РћРїРёСЃР°РЅРёРµ: JWT/РїР°СЂРѕР»Рё/cookie helpers (`bcrypt`, `jsonwebtoken`).
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
export const signAuthToken = (payload: AuthPayload) => {
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
};
```

## 4) server/accessRules.ts
- РћРїРёСЃР°РЅРёРµ: Р±РёР·РЅРµСЃ-Р»РѕРіРёРєР° РґР»СЏ `expires_at` Рё `device_id` РїСЂРёРІСЏР·РєРё.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
export const evaluateDeviceAccess = (params: {
  userDeviceId: string | null;
  requestDeviceId: string;
  expiresAt: string | Date | null;
}): AccessDecision => { ... }
```

## 5) server/accessRules.test.ts
- РћРїРёСЃР°РЅРёРµ: unit-С‚РµСЃС‚С‹ core-Р»РѕРіРёРєРё device/expiry.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
it("denies login from different device", () => {
  const result = evaluateDeviceAccess({ userDeviceId: "device-A", requestDeviceId: "device-B", expiresAt: null });
  expect(result.status).toBe(403);
});
```

## 6) server/cleanupExpired.ts
- РћРїРёСЃР°РЅРёРµ: С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ РѕС‡РёСЃС‚РєР° РїСЂРѕСЃСЂРѕС‡РµРЅРЅС‹С… Р°РєРєР°СѓРЅС‚РѕРІ (`deactivate`/`delete`).
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
export const cleanupExpiredUsers = async (mode: CleanupMode = "deactivate") => {
  if (mode === "delete") {
    return query(`DELETE FROM users WHERE expires_at IS NOT NULL AND expires_at < NOW() RETURNING id`);
  }
};
```

## 7) server/scripts/cleanupExpiredUsers.ts
- РћРїРёСЃР°РЅРёРµ: script РґР»СЏ СЂСѓС‡РЅРѕРіРѕ/cron Р·Р°РїСѓСЃРєР° cleanup.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
const rawMode = (process.argv[2] || "deactivate").toLowerCase();
const mode: CleanupMode = rawMode === "delete" ? "delete" : "deactivate";
```

## 8) server/index.ts
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅС‹ auth/admin endpoints, rate-limit, auth middleware, cookie+CORS, cleanup endpoint.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
app.post("/auth/login", loginRateLimit, async (req, res) => {
  const { login, password, deviceId } = req.body;
  ...
  const token = signAuthToken({ userId: user.id, role: user.role, deviceId, sessionId });
  res.setHeader("Set-Cookie", buildAuthCookie(token));
});
```

## 9) client/src/lib/deviceId.ts
- РћРїРёСЃР°РЅРёРµ: РѕРґРЅРѕСЂР°Р·РѕРІР°СЏ РіРµРЅРµСЂР°С†РёСЏ `deviceId` Рё СЃРѕС…СЂР°РЅРµРЅРёРµ РІ `localStorage`.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
const DEVICE_ID_STORAGE_KEY = "ios_msg_device_id";
export const getOrCreateDeviceId = () => { ... };
```

## 10) client/src/lib/api.ts
- РћРїРёСЃР°РЅРёРµ: РµРґРёРЅС‹Р№ API-РєР»РёРµРЅС‚ (`credentials: include` + bearer fallback).
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
const response = await fetch(apiUrl(path), {
  ...options,
  headers,
  credentials: "include",
});
```

## 11) client/src/contexts/AuthContext.tsx
- РћРїРёСЃР°РЅРёРµ: СЃРѕСЃС‚РѕСЏРЅРёРµ Р°РІС‚РѕСЂРёР·Р°С†РёРё, `login/logout/refreshUser`.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```tsx
const response = await apiRequest("/auth/login", {
  method: "POST",
  body: JSON.stringify(params),
});
```

## 12) client/src/pages/Login.tsx
- РћРїРёСЃР°РЅРёРµ: РЅРѕРІР°СЏ СЃС‚СЂР°РЅРёС†Р° Р»РѕРіРёРЅР° СЃ РѕС‚РїСЂР°РІРєРѕР№ `deviceId`.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```tsx
const nextUser = await login({
  login: loginValue,
  password: passwordValue,
  deviceId,
});
```

## 13) client/src/pages/Admin.tsx
- РћРїРёСЃР°РЅРёРµ: mobile-first Р°РґРјРёРЅ-РїР°РЅРµР»СЊ (users/sessions/create/reset/delete/extend/cleanup).
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```tsx
await apiRequest(`/admin/users/${targetUserId}/reset-device`, {
  method: "POST",
  token,
});
```

## 14) client/src/App.tsx
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅС‹ РјР°СЂС€СЂСѓС‚С‹ `/login`, `/admin` Рё route guards.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
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
- РћРїРёСЃР°РЅРёРµ: РїРѕРґРєР»СЋС‡РµРЅ `AuthProvider`.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```tsx
<AuthProvider>
  <App />
</AuthProvider>
```

## 16) client/src/vite-env.d.ts
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅС‹ type refs РґР»СЏ PWA virtual module.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

## 17) .env.example
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅС‹ env-С€Р°Р±Р»РѕРЅС‹ Supabase/JWT/CORS/cookie/rate-limit.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```env
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
JWT_SECRET=replace-with-long-random-secret
```

## 18) render.yaml
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅС‹ РїРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ РґР»СЏ РїСЂРѕРґ-Р°РІС‚РѕСЂРёР·Р°С†РёРё/Р‘Р”.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```yaml
- key: DATABASE_URL
  value: ""
- key: JWT_SECRET
  value: ""
```

## 19) README.md
- РћРїРёСЃР°РЅРёРµ: РїРѕС€Р°РіРѕРІС‹Рµ РёРЅСЃС‚СЂСѓРєС†РёРё РґР»СЏ Р СѓСЃР»Р°РЅР° (Supabase, Express, React, С‚РµСЃС‚С‹, deploy, curl).
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```md
## 1. Р§С‚Рѕ СЃРґРµР»Р°С‚СЊ РІ Supabase (С€Р°РіРё РґР»СЏ Р СѓСЃР»Р°РЅР°)
1. РћС‚РєСЂРѕР№ https://supabase.com Рё РЅР°Р¶РјРё `Start your project`.
```
## 20) server/scripts/createAdminUser.ts
- РћРїРёСЃР°РЅРёРµ: script РґР»СЏ РїРµСЂРІРѕРЅР°С‡Р°Р»СЊРЅРѕРіРѕ СЃРѕР·РґР°РЅРёСЏ/РѕР±РЅРѕРІР»РµРЅРёСЏ РїРµСЂРІРѕРіРѕ admin-РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
pnpm tsx server/scripts/createAdminUser.ts admin admin123
```

## 21) package.json
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅС‹ backend-Р·Р°РІРёСЃРёРјРѕСЃС‚Рё (`pg`, `bcryptjs`, `jsonwebtoken`), С‚РёРїС‹ Рё script `test:server`.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```json
"test:server": "vitest run --dir server"
```

## 22) pnpm-lock.yaml
- РћРїРёСЃР°РЅРёРµ: lockfile СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅ РїРѕСЃР»Рµ С„РёРєСЃР° Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№ backend auth/db.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```yaml
dependencies:
  pg:
  bcryptjs:
  jsonwebtoken:
```

## 23) client/src/contexts/AuthContext.tsx (performance update)
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅ Р»РѕРєР°Р»СЊРЅС‹Р№ РєСЌС€ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (`USER_CACHE_KEY`) РґР»СЏ РјРіРЅРѕРІРµРЅРЅРѕРіРѕ РѕС‚РєСЂС‹С‚РёСЏ РёРЅС‚РµСЂС„РµР№СЃР° Рё С„РѕРЅРѕРІРѕР№ РІР°Р»РёРґР°С†РёРё `/auth/me`.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```tsx
const [user, setUser] = useState<AuthUser | null>(() => readCachedUser());
const [isLoading, setIsLoading] = useState(() => readCachedUser() === null);
```

## 24) server/index.ts (Swagger docs update)
- РћРїРёСЃР°РЅРёРµ: СЂР°СЃС€РёСЂРµРЅ OpenAPI РґР»СЏ `/docs` - РґРѕР±Р°РІР»РµРЅС‹ РїРѕР»РЅС‹Рµ СЃС…РµРјС‹ request/response, РІСЃРµ auth/admin РјР°СЂС€СЂСѓС‚С‹ Рё `bearerAuth` РґР»СЏ РєРЅРѕРїРєРё `Authorize` РІ Swagger UI.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```ts
components: {
  securitySchemes: {
    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
  }
}
```

## 25) client/src/pages/Admin.tsx (Onay tools)
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅ РЅРѕРІС‹Р№ Р±Р»РѕРє `Onay Tools` РІ Р°РґРјРёРЅРєРµ РґР»СЏ С‚РµСЃС‚РёСЂРѕРІР°РЅРёСЏ `POST /api/onay/sign-in` Рё `POST /api/onay/qr-start` РїСЂСЏРјРѕ РёР· РёРЅС‚РµСЂС„РµР№СЃР°.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```tsx
<button onClick={handleOnaySignIn}>Refresh token bundle</button>
<form onSubmit={handleOnayTerminalCheck}>...</form>
```

## 26) client/src/pages/Admin.tsx (sessions refresh)
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅР° РєРЅРѕРїРєР° `Refresh` РІ СЃРµРєС†РёРё `Sessions and login logs`, РѕС‚РґРµР»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ Р·Р°РіСЂСѓР·РєРё Рё РѕС‚РјРµС‚РєР° РІСЂРµРјРµРЅРё РїРѕСЃР»РµРґРЅРµРіРѕ РѕР±РЅРѕРІР»РµРЅРёСЏ Р±РµР· РїРµСЂРµР·Р°РіСЂСѓР·РєРё РІСЃРµР№ СЃС‚СЂР°РЅРёС†С‹.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```tsx
<button onClick={refreshSessions}>Refresh</button>
<div>Last update: {sessionsUpdatedAt?.toLocaleTimeString()}</div>
```

## 27) client/src/pages/Login.tsx (UI simplification)
- РћРїРёСЃР°РЅРёРµ: СѓРїСЂРѕС‰С‘РЅ СЌРєСЂР°РЅ РІС…РѕРґР°: СѓР±СЂР°РЅС‹ Р»РёС€РЅРёРµ С‚РµРєСЃС‚РѕРІС‹Рµ Р±Р»РѕРєРё, Р·Р°РіРѕР»РѕРІРѕРє `Login` РїРѕ С†РµРЅС‚СЂСѓ, placeholder РґР»СЏ Р»РѕРіРёРЅР° РёР·РјРµРЅС‘РЅ РЅР° `name`, РґРѕР±Р°РІР»РµРЅ РіР»Р°Р·РѕРє РїРѕРєР°Р·Р°С‚СЊ/СЃРєСЂС‹С‚СЊ РїР°СЂРѕР»СЊ.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```tsx
<input placeholder="name" />
<button type="button">{showPassword ? <EyeOff /> : <Eye />}</button>
```

## 28) client/src/pages/Admin.tsx (elastic iOS redesign)
- РћРїРёСЃР°РЅРёРµ: РѕР±РЅРѕРІР»С‘РЅ РІРёР·СѓР°Р»СЊРЅС‹Р№ СЃС‚РёР»СЊ Р°РґРјРёРЅРєРё РїРѕРґ iOS (glassmorphism/РіСЂР°РґРёРµРЅС‚С‹), СѓР»СѓС‡С€РµРЅР° Р°РґР°РїС‚РёРІРЅРѕСЃС‚СЊ mobile-first, РґРѕР±Р°РІР»РµРЅС‹ РїР»Р°РІРЅС‹Рµ Р°РЅРёРјР°С†РёРё РїРѕСЏРІР»РµРЅРёСЏ СЃРµРєС†РёР№ Рё РєР°СЂС‚РѕС‡РµРє С‡РµСЂРµР· `framer-motion`, СѓСЃРёР»РµРЅС‹ touch-friendly РєРѕРЅС‚СЂРѕР»С‹.
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
```tsx
import { AnimatePresence, motion } from "framer-motion";
<motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} />
```

## 29) client/src/pages/Admin.tsx (auto-refresh + skeletons + swipe actions)
- РћРїРёСЃР°РЅРёРµ: РґРѕР±Р°РІР»РµРЅС‹ skeleton-Р·Р°РіР»СѓС€РєРё РґР»СЏ users/sessions, Р°РІС‚РѕРѕР±РЅРѕРІР»РµРЅРёРµ СЃРµСЃСЃРёР№ РєР°Р¶РґС‹Рµ 15 СЃРµРєСѓРЅРґ СЃ РїР°СѓР·РѕР№ РїСЂРё РЅРµР°РєС‚РёРІРЅРѕР№ РІРєР»Р°РґРєРµ, Рё swipe-left Р±С‹СЃС‚СЂС‹Рµ РґРµР№СЃС‚РІРёСЏ РЅР° РєР°СЂС‚РѕС‡РєР°С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РґР»СЏ iOS (mobile).
- РџСЂРёРјРµСЂ РґРёС„С„Р°:
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
<h1 className="text-3xl font-bold tracking-tight">РЎРѕРѕР±С‰РµРЅРёСЏ</h1>
<p className="text-xs text-gray-500">Р”Р»СЏ API РЅР°Р¶РјРёС‚Рµ В«РћС‚РєСЂС‹С‚СЊВ», РґР»СЏ СЂСѓС‡РЅРѕРіРѕ СЂРµР¶РёРјР° РЅР°Р¶РјРёС‚Рµ В«Р’ С‡Р°С‚В».</p>
```

## 36) client/src/pages/Chat.tsx + client/src/components/MessageBubble.tsx (iMessage-like chat UI)
- Description: Chat composer redesigned to iMessage-like layout (left plus, "РўРµРјР°" row, divider, "РўРµРєСЃС‚РѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ вЂў SMS" input) and mic icon now switches to green send button when input has digits/text; message bubbles restyled with rounded tails, from-bottom animation, and white underline on sent bubble text.
- Date: 2026-02-12
- Diff sample:
```tsx
{canSend ? <ArrowUp ... /> : <Mic ... />}
<div className="text-[20px] font-semibold text-[#9ea0a9]">РўРµРјР°</div>
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

## 46) client/src/pages/Admin.tsx (sessions auto-refresh every 10 minutes)
- Description: Increased admin sessions auto-refresh interval from 15 seconds to 10 minutes to reduce frequent background polling.
- Date: 2026-02-12
- Diff sample:
```ts
const SESSIONS_AUTO_REFRESH_MS = 10 * 60 * 1000;
```

## 47) client/src/pages/Admin.tsx + server/index.ts (new terms: 1 week trial and 1 month)
- Description: Added new account term options `1 week (trial)` and `1 month` in admin create-user form and extend actions; backend `/admin/users/:id/extend` now supports `weeks` in addition to `months`.
- Date: 2026-02-12
- Diff sample:
```tsx
type UserTerm = "1w" | "1m" | "3m" | "6m" | "permanent";
<option value="1w">1 week (trial)</option>
<option value="1m">1 month</option>
```
```ts
if (hasWeeks) {
  ... make_interval(weeks => $2::int)
}
```

## 48) client/src/pages/Admin.tsx + server/index.ts (remove 1-week option from extension)
- Description: Removed `1 week` from user extension flow as requested. Weekly term remains available only at user creation (`1 week (trial)`), while extension supports `1 month / 3 months / 6 months / permanent`.
- Date: 2026-02-12
- Diff sample:
```tsx
type ExtendUserTerm = "1m" | "3m" | "6m" | "permanent";
```
```ts
// weekly extend branch removed from /admin/users/:id/extend
```

## 53) client/index.html + client/src/App.tsx (remove startup boot screen)
- Description: Removed the startup boot/preload card from both raw HTML and React fallbacks. The app now opens without the "Р—Р°РіСЂСѓР·РєР°... / РћС‚РєСЂС‹РІР°РµРј РїСЂРёР»РѕР¶РµРЅРёРµ" card and without a replacement spinner.
- Date: 2026-03-19
- Diff sample:
```html
<div id="root"></div>
```
```tsx
<Suspense fallback={null}>
if (isLoading) return null;
```

## 54) auth session persistence + deviceId backup cookie
- Description: Reduced forced re-login by extending auth session defaults to 30 days and rotating auth on `/auth/me`. Hardened `deviceId` persistence by syncing it between `localStorage` and a long-lived cookie, plus refreshing a server-set device cookie after login/bootstrap.
- Date: 2026-03-19
- Diff sample:
```ts
const expiresIn = (process.env.JWT_EXPIRES_IN || "30d") as jwt.SignOptions["expiresIn"];
```
```ts
res.setHeader("Set-Cookie", [buildAuthCookie(token), buildDeviceIdCookie(deviceId)]);
```
```ts
const cookieDeviceId = readCookieValue("app_device_id");
```

## 55) client/src/pages/Chat.tsx (fix first iPhone keyboard open positioning)
- Description: Fixed the first-focus iPhone composer glitch by disabling initial iOS auto-focus, measuring keyboard inset against the pre-keyboard viewport height, and running extra sync passes right after the first input focus.
- Date: 2026-03-19
- Diff sample:
```ts
const viewportBaseHeightRef = useRef(typeof window !== "undefined" ? window.innerHeight : 0);
```
```ts
bottom: keyboardOffset > 0 ? keyboardOffset + 8 : 10,
```

## 56) faster cached entry route + earlier client route warmup
- Description: Improved startup on weak/offline networks by restoring the last authenticated route before React mounts, remembering the last opened screen, warming essential mobile routes earlier, and registering the service worker immediately.
- Date: 2026-03-19
- Diff sample:
```ts
bootstrapClientRoute();
```
```ts
rememberLastAuthedRoute(currentRoute, user.role);
```

## 57) client/src/lib/travelStats.ts + client/src/components/TravelStatsPanel.tsx + client/src/pages/Home.tsx (local ride spending dashboard)
- Description: Added a local-only travel statistics dashboard on the home screen. It derives spending, ride counts, favorite routes, vehicle numbers, and daily/weekly/monthly/yearly trends only from saved successful chat history. Failed/error responses are ignored automatically because they do not include ride details. Clearing history now also refreshes and clears the dashboard immediately.
- Date: 2026-03-19
- Diff sample:
```ts
const stats = useMemo(() => buildTravelStats(period), [period, refreshKey, revision]);
```
```tsx
<TravelStatsPanel refreshKey={statsRefreshKey} />
```
```ts
if (message.isMe || !message.details) return null;
```

## 58) client/src/components/TravelStatsPanel.tsx + client/src/pages/Home.tsx (compact stats layout and API section order)
- Description: Removed the circular share indicator from the spending hero, made the stats cards more compact for mobile, fixed narrow badges so counts stay on one line, moved the API card above statistics, and compressed the routes list with a preview mode, toggle, and internal scroll for long histories.
- Date: 2026-03-19
- Diff sample:
```tsx
<TravelStatsPanel refreshKey={statsRefreshKey} />
```
```tsx
{showAllRoutes ? "РџРѕРєР°Р·Р°С‚СЊ РјРµРЅСЊС€Рµ" : `РџРѕРєР°Р·Р°С‚СЊ РІСЃРµ (${stats.routeStats.length})`}
```
```tsx
<div className="shrink-0 whitespace-nowrap ...">{stats.rideCount} РїРѕРµР·РґРѕРє</div>
```

## 59) migrations/002_create_onay_credentials.sql + server/onayCredentials.ts + server/index.ts (saved Onay account override)
- Description: Added a persistent admin-managed Onay account override stored in PostgreSQL instead of forcing Render env changes. The server now supports reading the active Onay account summary, saving a new validated phone/password pair, resetting back to env defaults, reusing the saved account for `Refresh token bundle`, and bulk cleanup of closed session logs.
- Date: 2026-03-19
- Diff sample:
```sql
CREATE TABLE IF NOT EXISTS onay_credentials (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phone_number_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL
);
```
```ts
const response = await apiRequest<OnaySaveAccountResponse>("/admin/onay/account", {
  method: "POST",
  token,
  body: JSON.stringify({ phoneNumber, password }),
});
```
```ts
app.post("/admin/sessions/cleanup", requireAuth, requireAdmin, async (req, res) => {
```

## 60) client/src/pages/Admin.tsx (Onay account management, compact lists, progress feedback)
- Description: Improved admin UX with a saved Onay account dialog, confirmation popup before token refresh, compact users list with internal scroll, closed sessions cleanup action, per-action loading states, progress banners, and more visible feedback for reset/extend/delete operations.
- Date: 2026-03-19
- Diff sample:
```tsx
<Dialog open={showOnayRefreshConfirm} onOpenChange={setShowOnayRefreshConfirm}>
```
```tsx
<ScrollArea className="max-h-[620px]">
```
```tsx
{isPendingAction(`user:${entry.id}:extend:1m`) ? "Saving..." : "+1 Month"}
```

## 61) client/src/pages/Admin.tsx (mobile users list overlap cleanup)
- Description: Tightened the mobile `Users` scroll area height and made the swipe-action/background layers fully opaque so the users block no longer visually bleeds into the sessions block and hidden quick actions stop showing through cards.
- Date: 2026-03-19
- Diff sample:
```tsx
<ScrollArea className="max-h-[520px] sm:max-h-[620px]">
```
```tsx
className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0b0e14]"
```

## 62) client/src/pages/Admin.tsx (native mobile scroll for users list)
- Description: Replaced the Radix `ScrollArea` wrapper in the `Users` section with native `overflow-y-auto`, because the previous wrapper still allowed the list to visually run under the sessions block on mobile. The users list now scrolls inside its own section reliably.
- Date: 2026-03-19
- Diff sample:
```tsx
<div className="max-h-[520px] overflow-y-auto pr-1 sm:max-h-[620px]">
```

## 63) client/src/App.tsx + client/src/pages/Login.tsx + client/src/pages/Home.tsx + client/src/lib/bootstrapRoute.ts + client/src/pages/Admin.tsx (shared Home entry for admin accounts)
- Description: Stopped forcing admin accounts straight into `/admin` on login, root redirects, and cached startup. Admin users now open the regular Home screen like everyone else, and Home includes a dedicated "РћС‚РєСЂС‹С‚СЊ" entry card above the API section for jumping into the protected admin panel when needed.
- Date: 2026-03-19
- Diff sample:
```tsx
navigate("/home", { replace: true });
```
```tsx
{user?.role === "admin" ? (
  <Button onClick={() => setLocation("/admin")}>РћС‚РєСЂС‹С‚СЊ</Button>
) : null}
```
```ts
return "/home";
```

## 64) client/src/pages/Admin.tsx (restore translucent swipe hints and reorder Onay result panels)
- Description: Brought back a subtle translucent mobile overlay in the Users list so swipe actions softly show through behind each card again, while keeping the list scrollable. Reordered `Onay Tools` so `Sign-in result` now appears directly under `Current Onay account`, with the latency metrics moved below it.
- Date: 2026-03-19
- Diff sample:
```tsx
className="relative z-10 ... bg-[linear-gradient(135deg,rgba(16,20,27,0.78),rgba(11,15,22,0.72))] ..."
```
```tsx
<div className="text-sm font-semibold text-white">Sign-in result</div>
```
```tsx
<div className="grid grid-cols-1 gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3">
```

## 65) client/src/pages/Home.tsx + client/src/pages/Admin.tsx (shared logout on Home and collapsible Onay tools)
- Description: Moved account logout out of the admin header and into the shared Home screen so every authenticated user can sign out from one place with a confirmation dialog. The admin header now has a back-to-Home button, and `Onay Tools` is collapsed behind a chevron toggle with a shorter description for a cleaner first view.
- Date: 2026-03-19
- Diff sample:
```tsx
<Button onClick={() => setShowLogoutConfirm(true)}>Р’С‹Р№С‚Рё РёР· Р°РєРєР°СѓРЅС‚Р°</Button>
```
```tsx
<button onClick={() => navigate("/home")}>РќР°Р·Р°Рґ РЅР° РіР»Р°РІРЅС‹Р№ СЌРєСЂР°РЅ</button>
```
```tsx
{isOnayToolsOpen ? <motion.div key="onay-tools-body">...</motion.div> : null}
```

## 66) client/src/lib/chat2505.ts + client/src/components/Chat2505Card.tsx + client/src/pages/Home.tsx + client/src/pages/Chat.tsx + client/src/contexts/ChatContext.tsx (new local 2505 transport chat mode)
- Description: Added a separate local `2505` chat mode under Home, with its own phone/settings storage, searchable transport list, validation, local history, and SMS-style reply generator. The new mode opens through `/chat?mode=2505`, never mixes with the existing `api/manual` histories, and shared history cleanup now also resets the local `2505` data.
- Date: 2026-03-26
- Diff sample:
```ts
export const CHAT2505_SETTINGS_STORAGE_KEY = "ios_msg_2505_settings";
```
```tsx
<Chat2505Card resetKey={statsRefreshKey} onOpen={() => setLocation("/chat?mode=2505")} />
```
```ts
const mode = queryMode === "api" ? "api" : queryMode === "2505" ? "2505" : "manual";
```

## 67) client/src/components/MessageBubble.tsx + client/src/lib/chat2505.ts + client/src/lib/chat2505.test.ts + client/src/pages/Chat.tsx (match 2505 SMS bubble to the original layout)
- Description: Tightened the local `2505` SMS presentation so the generated gray reply matches the reference more closely: fixed multiline labels, restored the centered `РўРµРєСЃС‚РѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ вЂў SMS` / `РЎРµРіРѕРґРЅСЏ HH:mm` header, highlighted `РўР РђРќРЎРџРћР Рў` and `РўР РђРќР—РђРљР¦РРЇ` in blue with underlines, and tuned the incoming bubble width/spacing for the denser native look.
- Date: 2026-03-26
- Diff sample:
```tsx
if (details?.kind === "2505" && index === 3) {
  return <div key={index}>{renderHighlightedValue(line, details.transportCode)}</div>;
}
```
```ts
`${REPLY_LINES.transport}: ${code} (${plate})`,
`${REPLY_LINES.transaction}: ${transactionId}`,
```
```tsx
{"\u0422\u0435\u043a\u0441\u0442\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u2022 SMS"}
```

## 68) client/src/pages/Chat.tsx + client/src/components/MessageBubble.tsx + client/src/lib/travelStats.ts (clean mojibake strings, restore API currency sign, and count 2505 rides in stats)
- Description: Replaced the remaining broken Russian UI strings in the chat screen and long-press action sheet, restored the proper `в‚ё` symbol in API-generated Onay messages, reduced the 2505 header size back to a lighter compact look, showed timestamps for each sent 2505 code again, softened the 2505 reply bubble weight, and extended local travel stats so successful `2505` rides are counted by transport code and plate alongside API rides.
- Date: 2026-03-26
- Diff sample:
```ts
const price =
  typeof data.cost === "number"
    ? `${Math.round(data.cost / 100)}в‚ё`
    : settings.price || "120в‚ё";
```
```tsx
showTimestamp={msg.isMe}
```
```ts
const chat2505Messages = readStoredMessages(
  SESSION_STORAGE_KEY_MESSAGES_2505,
  STORAGE_KEY_MESSAGES_2505,
);
```

## 69) client/src/pages/Chat.tsx (hide empty 2505 top header until the first message)
- Description: Removed the empty `Текстовое сообщение • SMS` placeholder block from the top of the `2505` chat when the conversation has no messages yet. Now the header area stays clean on first open, and only `Сегодня HH:mm` appears after the first sent code creates the conversation.
- Date: 2026-03-26
- Diff sample:
```tsx
{mode === "2505" && activeMessages.length > 0 ? (
  <div className="mb-4 pt-0.5 text-center text-[#8E8E93]">
    <div className="text-[11px] font-medium tracking-[0.01em]">{conversationMetaLabel}</div>
  </div>
) : null}
```

## 70) client/src/pages/Chat.tsx + client/src/components/MessageBubble.tsx (remove duplicated first 2505 timestamp and tune reply bubble spacing)
- Description: Prevented the first sent `2505` code from repeating the same `Сегодня HH:mm` timestamp that already appears in the compact conversation header. Also darkened the `2505` reply bubble to `#262628` and slightly increased the vertical spacing between reply lines for a cleaner SMS look.
- Date: 2026-03-26
- Diff sample:
```tsx
showTimestamp={msg.isMe && !(mode === "2505" && index === 0)}
```
```tsx
? "rounded-[22px] rounded-bl-[10px] bg-[#262628] text-[#f1f2f6]"
```

## 71) client/src/lib/chat2505.ts + client/src/components/Chat2505Card.tsx + client/src/lib/travelStats.ts + client/src/lib/chat2505.test.ts (group 2505 transports by route and show stats by real route/plate)
- Description: Reworked the `2505` local settings from one flat transport list into route groups. The seeded codes are now stored inside default route `5`, new routes can be created locally, new transport codes can be added into any route, and the settings card shows route count plus total code count with nested expandable lists. Travel stats now count successful `2505` rides by the actual route name and plate instead of treating the transport code as the route.
- Date: 2026-03-26
- Diff sample:
```ts
export type Chat2505Settings = {
  phone: string;
  routes: Chat2505Route[];
};
```
```tsx
<div className="text-sm font-semibold text-white">
  Маршрут {route.name}
</div>
```
```ts
route: message.details.route || message.details.transportCode || "—",
plate: message.details.number || message.details.transportPlate || "—",
```


## 72) client/src/lib/chat2505.ts (tolerate hidden iPhone keyboard characters in 2505 transport input)
- Description: Hardened `2505` transport input normalization so codes like `24506(761AJ05)` still validate even if iPhone inserts hidden zero-width or compatibility characters. The parser now applies `NFKC` normalization and strips invisible characters before matching the strict transport format.
- Date: 2026-03-26
- Diff sample:
```ts
const toUpperCompact = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
```

## 73) client/src/lib/chat2505.ts + client/src/components/Chat2505Card.tsx + client/src/lib/chat2505.test.ts (smart auto-format for 2505 transport input)
- Description: Made the `2505` transport field smarter on mobile. The input now auto-normalizes and formats transport codes into `24506(761AJ05)` while typing, even if the user enters the value without brackets, with spaces, in lowercase, or with hidden iPhone keyboard characters. The field also disables autocorrect/spellcheck and enables character auto-capitalization for cleaner transport entry.
- Date: 2026-03-26
- Diff sample:
```ts
expect(formatChat2505TransportDraft("24506761aj05")).toBe("24506(761AJ05)");
```
```tsx
autoCapitalize="characters"
autoCorrect="off"
spellCheck={false}
```

## 74) client/src/lib/chat2505.ts + client/src/components/Chat2505Card.tsx + client/src/lib/chat2505.test.ts (accept both 2505 transport plate variants)
- Description: Expanded `2505` transport validation to accept the correct `2505` plate format `3 цифры + 2 буквы + 2 цифры`, for example `628ВН05` and `761AJ05`. Updated the UI hint/error text so the accepted formats are explicit, and covered the parser with the corrected examples.
- Date: 2026-03-26
- Diff sample:
```ts
const TRANSPORT_2505_INPUT_PATTERN =
  /^(\d{5})\(([0-9]{3}(?:[A-Z\u0410-\u042f\u0401]{3}[0-9]|[A-Z\u0410-\u042f\u0401]{2}[0-9]{2}))\)$/;
```

## 75) client/src/lib/chat2505.ts + client/src/components/Chat2505Card.tsx + client/src/lib/travelStats.ts + client/src/lib/chat2505.test.ts (lock 2505 plates to 3 digits + 2 letters + 2 digits and normalize old O→0 input)
- Description: Corrected the `2505` transport plate rule to the final strict format `3 digits + 2 letters + 2 digits`, for example `628ВН05` and `761AJ05`. Seeded route `5` plates, parser tests, UI hints, and travel stats now use this format. Legacy values like `628ВНО5` or `761AJO5` are auto-normalized to `628ВН05` / `761AJ05` when read or typed.
- Date: 2026-03-26
- Diff sample:
```ts
const TRANSPORT_2505_INPUT_PATTERN =
  /^(\d{5})\(([0-9]{3}[A-Z\u0410-\u042f\u0401]{2}[0-9]{2})\)$/;
```

## 76) client/src/components/MessageBubble.tsx + client/src/lib/chat2505.ts + client/src/lib/chat2505.test.ts (match 2505 bubble tail color and lock ticket format to 0ddd:15:dddd)
- Description: Finished the `2505` SMS visual alignment by tinting the incoming bubble tail with the same `#262628` background as the bubble body. Also changed local ticket generation from a fully random `dddd:dd:dddd` pattern to the fixed shape `0ddd:15:dddd`, so the leading `0` and middle `15` are always present.
- Date: 2026-03-26
- Diff sample:
```tsx
style={{ color: isMe ? "#2fbe51" : is2505Reply ? "#262628" : "#2a2b34" }}
```
```ts
export const generateChat2505Ticket = () => `0${randomDigits(3)}:15:${randomDigits(4)}`;
```

## 77) client/src/pages/Chat.tsx (add realistic delayed delivery for local 2505 replies)
- Description: Made the local `2505` chat feel closer to a real payment flow. Sent codes still appear immediately, but the generated incoming ticket reply now arrives after a short randomized delay (about 1.1s to 2.2s) instead of appearing instantly. The reply bubble timestamp is also stamped at delivery time so the chat feels more natural.
- Date: 2026-03-26
- Diff sample:
```ts
const CHAT2505_RESPONSE_DELAY_MIN_MS = 1100;
const CHAT2505_RESPONSE_DELAY_MAX_MS = 2200;
```
```ts
setChat2505Messages((prev) => trimChat2505Messages([...prev, userMessage]));
schedule2505Response(responseMessage);
```

## 78) client/src/components/Chat2505Card.tsx (collapse route groups by default and make the Open button blue)
- Description: Updated the `2505` card on Home so route groups inside the settings panel start collapsed instead of auto-expanding the first route. Also switched the `Открыть` CTA to the same blue action style used elsewhere, while keeping a softer disabled state when the phone or transport list is incomplete.
- Date: 2026-03-26
- Diff sample:
```tsx
setExpandedRoutes(Object.fromEntries(restored.routes.map((route) => [route.id, false])));
```
```tsx
className="h-10 rounded-xl bg-ios-blue px-4 text-sm font-semibold text-white ..."
```

## 79) client/src/components/Chat2505Card.tsx + client/src/components/MessageBubble.tsx (fix iPhone 2505 card header wrapping and enlarge 2505 ticket bubble)
- Description: Reworked the `Чат с 2505` card header into a mobile-first stacked layout so the blue `Открыть` button no longer crowds the title/description on iPhone widths. Also enlarged the incoming `2505` ticket bubble by increasing its width, padding, line spacing, and text size, bringing the local ticket closer to the visual scale of the original SMS reference.
- Date: 2026-03-26
- Diff sample:
```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
```
```tsx
? "max-w-[79%] px-[16px] py-[13px] sm:max-w-[74%] sm:px-[15px] sm:py-[12px]"
```

## 80) client/src/components/Chat2505Card.tsx + client/src/components/MessageBubble.tsx (restore 2505 Open button position, prevent phone overflow, and darken the ticket bubble)
- Description: Restored the `Открыть` button in the `Чат с 2505` card back to the top-right position while keeping the text area flexible and tightening the phone metric so it no longer spills out on iPhone widths. Also tuned the `2505` incoming ticket bubble closer to the real SMS look by slightly narrowing it, darkening the background, matching the tail tint, and making the text feel denser and more saturated.
- Date: 2026-03-26
- Diff sample:
```tsx
<div className="min-w-0 flex-1 space-y-1 pr-1">
```
```tsx
? "rounded-[22px] rounded-bl-[10px] bg-[#232329] text-[#f4f5f8]"
```

## 81) client/src/components/MessageBubble.tsx + client/src/components/Chat2505Card.tsx (soften 2505 text weight, reuse the darker bubble for API replies, and tighten the routes metric label)
- Description: Reduced the visual heaviness of the `2505` reply text by moving it from semibold to a slightly softer medium weight. Applied the same darker `#232329` incoming bubble/tail treatment to API chat replies for a more consistent look. Also tightened the letter spacing and left alignment of the `Маршрутов` metric label in the `2505` card so it no longer pushes toward the edge on iPhone widths.
- Date: 2026-03-26
- Diff sample:
```tsx
const isApiReply = details?.kind === "api" && !isMe;
```
```tsx
<div className="pl-[1px] text-[10px] uppercase tracking-[0.2em] text-gray-500">
  Маршрутов
</div>
```

## 82) client/src/pages/Chat.tsx (stabilize iPhone keyboard opening in API chat and lift the composer above the iOS number-key toolbar)
- Description: Hardened the chat composer positioning on iPhone so the API chat no longer randomly jumps into the wrong place when the numeric keyboard opens. The fix adds a short settling sequence after `focus` to re-sync against delayed `visualViewport` updates and applies an iOS-specific toolbar lift so the composer clears the accessory bar instead of getting trapped underneath it.
- Date: 2026-03-26
- Diff sample:
```ts
const IOS_KEYBOARD_TOOLBAR_OFFSET = 46;
const IOS_KEYBOARD_SETTLE_DELAYS_MS = [0, 90, 180, 320, 520, 760];
```
```ts
const composerBottomOffset =
  keyboardOffset > 0
    ? keyboardOffset + (isIOSRef.current ? IOS_KEYBOARD_TOOLBAR_OFFSET : 8)
    : 10;
```

## 83) client/src/pages/Home.tsx (show current user name and account period status in the top Messages header)
- Description: Personalized the top `Сообщения` header on Home by surfacing the current user login and a compact account period badge. The header now shows whether the account is permanent, active until a specific date, expired, or has an unreadable period value, so users can immediately see their access status without opening the admin panel.
- Date: 2026-03-27
- Diff sample:
```tsx
const accountPeriod = useMemo(() => {
  if (!user?.expiresAt) {
    return { title: "Бессрочный", subtitle: "Без ограничения по времени" };
  }
```
```tsx
<div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">Период</div>
<div className={`mt-1 text-[14px] font-semibold ${accountPeriod.toneClass}`}>
  {accountPeriod.title}
</div>
```

## 84) client/src/pages/Home.tsx (remove mojibake from Home labels and normalize the тенге sign)
- Description: Cleaned the remaining broken Cyrillic on the Home screen by rewriting visible labels, button texts, helper descriptions, and Onay toasts with stable UTF-8/Unicode-escaped strings. Also normalized the stored manual price so older malformed values like `120в‚ё` are converted back into a proper `120₸` display.
- Date: 2026-03-27
- Diff sample:
```tsx
const [price, setPrice] = useState(() => {
  const rawPrice = settings.price || "120";
  const normalizedDigits = rawPrice.replace(/\D+/g, "");
  return `${normalizedDigits || "120"}₸`;
});
```
```tsx
<div className="text-base font-semibold">{"Чат через API"}</div>
```

## 85) client/src/components/UpdateNotice.tsx (replace the onboarding instructions with a mandatory lawful-use agreement)
- Description: Replaced the old “how to use the app” onboarding card with a mandatory lawful-use agreement screen. Users must actively confirm a checkbox before the app becomes available. The agreement now explains that the service must be used only within the law, that the user is personally responsible for their actions and consequences, and that the text is informational rather than legal advice. The separate “What’s new” notice still works after agreement acceptance.
- Date: 2026-03-27
- Diff sample:
```tsx
const AGREEMENT_STORAGE_KEY = "ios_msg_seen_agreement_id";
const LEGAL_AGREEMENT_VERSION = "2026-03-27-lawful-use-kz";
```
```tsx
<Checkbox
  id="lawful-use-consent"
  checked={agreed}
  onCheckedChange={(checked) => setAgreed(checked === true)}
/>
```

## 86) client/src/pages/Home.tsx (replace the short mode hint with a collapsible step-by-step instruction block)
- Description: Removed the two short helper lines under the Home header and replaced them with a collapsible `Инструкция` section. The new guide explains, in simple language, how to use the API chat, the local `2505` chat, the manual mode, and where to find key actions such as clearing local history. The instructions stay hidden by default so the header remains compact, but they can be expanded when the user needs help.
- Date: 2026-03-27
- Diff sample:
```tsx
const [isGuideOpen, setIsGuideOpen] = useState(false);
```
```tsx
<div className="text-sm font-semibold text-white">1. Чат через API</div>
<div className="mt-1 text-xs leading-5 text-gray-400">
  Нажмите «Открыть», если хотите получить данные из Onay автоматически.
</div>
```

## 87) client/src/pages/Home.tsx (animate the instruction accordion and add a safe password-status card under the account info)
- Description: Upgraded the Home header card with a smoother `Инструкция` accordion using `AnimatePresence` and height/opacity transitions, so expanding and collapsing feels lighter and more polished. Also added a dedicated `Просмотр пароля` status block under the account tiles. Because the app does not retain the real password after login, this block now explains that password viewing is unavailable post-authentication instead of pretending the password can be revealed.
- Date: 2026-03-27
- Diff sample:
```tsx
import { EyeOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
```
```tsx
<div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{"\\u041f\\u0440\\u043e\\u0441\\u043c\\u043e\\u0442\\u0440 \\u043f\\u0430\\u0440\\u043e\\u043b\\u044f"}</div>
<div className="mt-1 text-[14px] font-semibold text-white">{"\\u041d\\u0435\\u0434\\u043e\\u0441\\u0442\\u0443\\u043f\\u043d\\u043e \\u043f\\u043e\\u0441\\u043b\\u0435 \\u0432\\u0445\\u043e\\u0434\\u0430"}</div>
```

## 88) client/src/pages/Home.tsx (fix the instruction toggle so only the chevron rotates)
- Description: Corrected the instruction toggle pill in the Home header. Previously the entire badge was rotated, which flipped the `Скрыть` text upside down when the accordion opened. The control now keeps the label readable at all times and rotates only a dedicated chevron icon.
- Date: 2026-03-27
- Diff sample:
```tsx
import { ChevronDown, EyeOff } from "lucide-react";
```
```tsx
<motion.span animate={{ rotate: isGuideOpen ? 180 : 0 }}>
  <ChevronDown size={14} />
</motion.span>
```

## 89) client/src/lib/rememberedPassword.ts + client/src/pages/Login.tsx + client/src/pages/Home.tsx (add opt-in remember-and-show-password on this device)
- Description: Added an explicit opt-in flow for saving a password locally on the current device. The login screen now includes a `Запомнить пароль на этом устройстве` checkbox, restores the last remembered credentials when available, and stores or removes the password per login based on the user’s choice. The Home header now shows a password device-status card where the remembered password can be shown, hidden, or deleted from local storage, with a warning that local storage is less safe than not storing it at all.
- Date: 2026-03-27
- Diff sample:
```tsx
const [rememberPasswordEnabled, setRememberPasswordEnabled] = useState(false);
```
```tsx
{rememberedPassword ? (
  <button type="button" onClick={() => setShowRememberedPassword((prev) => !prev)}>
    {showRememberedPassword ? "Скрыть" : "Показать"}
  </button>
) : null}
```

## 90) server/index.ts + client/src/pages/Admin.tsx (add admin password reset flow without exposing current passwords)
- Description: Added a safe admin password-management flow. Admins can now open a `Set new password` dialog for any user directly from the Users list and submit a replacement password with a visibility toggle. The server now exposes `POST /admin/users/:id/password`, hashes the new password, invalidates the target user’s other sessions, and writes an admin action log. The current plaintext password is intentionally not viewable because the system stores only hashes.
- Date: 2026-03-27
- Diff sample:
```ts
app.post("/admin/users/:id/password", requireAuth, requireAdmin, async (req, res) => {
  const passwordHash = await hashPassword(password);
});
```
```tsx
<DialogTitle>Set new password</DialogTitle>
<DialogDescription className="text-gray-400">
  Current password cannot be viewed because the system stores only a hash.
</DialogDescription>
```

## 91) client/src/pages/Home.tsx (move admin access into the compact account header block)
- Description: Removed the separate full-width admin panel card from Home and moved admin access into the compact top account area. Admin users now see a small clickable access tile directly under the `Имя / Период` cards, with an `admin` badge and a one-tap entry into the admin panel. This keeps the Home screen tighter and makes the admin path visible right where the account summary already lives.
- Date: 2026-03-27
- Diff sample:
```tsx
{user?.role === "admin" ? (
  <button type="button" onClick={() => setLocation("/admin")}>
    <span>admin</span>
    <span>Открыть админ панель</span>
  </button>
) : null}
```

## 92) vite.config.ts + client/src/main.tsx + client/src/App.tsx + client/src/components/QrScannerSheet.tsx + server/index.ts (site-wide startup and caching optimization without visual changes)
- Description: Optimized the app startup path and repeat-load performance without changing the UI. Production builds now skip dev-only location/runtime plugins, removing `data-loc` attributes from shipped bundles. Vendor code is split into smaller chunks, service worker registration is deferred until load/idle, QR decoding is lazy-loaded only when the scanner is actually opened, and Express now sends stronger cache headers for static assets. Route warmup still exists, but it now runs during browser idle after page load so it no longer competes with the first screen render.
- Date: 2026-03-27
- Diff sample:
```ts
!isProductionBuild ? jsxLocPlugin() : null,
!isProductionBuild ? vitePluginManusRuntime() : null,
```
```ts
const { default: jsQR } = await loadJsQr();
```
```ts
res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
```

## 93) client/src/lib/travelStats.ts + client/src/components/TravelStatsPanel.tsx (add date picker and exact day zoom for travel spend analytics)
- Description: Expanded the local travel analytics so the user can anchor stats to a specific date instead of only looking at today/current week/current month. The stats engine now accepts a selected date, clamps all ranges to the supported window from January 1, 2025 through today, and localizes weekly/monthly labels. The Travel Stats panel now has a calendar trigger, a date picker dialog, and a `Приблизить` mode for daily analytics that swaps the hourly overview for exact payment times with a detailed list of rides and timestamps.
- Date: 2026-03-27
- Diff sample:
```ts
export const buildTravelStats = (
  period: TravelPeriod,
  options?: { anchorDate?: Date },
): TravelStats => {
```
```tsx
<button type="button" onClick={() => setIsCalendarOpen(true)}>
  <CalendarDays className="size-3.5" />
  <span>{selectedDateLabel}</span>
</button>
```
```tsx
{period === "day" && isDayZoomed && stats.filteredRides.length > 0 ? (
  <div className="mt-3 rounded-[20px] border border-white/8 bg-[#0c1119]/88 p-3">
```

## 94) client/src/pages/Home.tsx (make the top Messages account block collapsible and remember its state locally)
- Description: Turned the top `Сообщения` header card into a smooth collapsible section. The user can now fold or expand the whole account summary block, and the chosen state is saved in local storage so it stays the same after refreshes and later visits. The toggle uses the same soft motion language as the rest of the page and keeps the layout compact when the user wants more space on the Home screen.
- Date: 2026-03-27
- Diff sample:
```tsx
const HOME_HEADER_OPEN_KEY = "ios_home_header_open";
const [isHomeHeaderOpen, setIsHomeHeaderOpen] = useState(() => {
  const saved = window.localStorage.getItem(HOME_HEADER_OPEN_KEY);
  return saved === null ? true : saved === "true";
});
```
```tsx
<AnimatePresence initial={false}>
  {isHomeHeaderOpen ? (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
```

## 95) client/src/lib/travelStats.ts + client/src/components/TravelStatsPanel.tsx (make the spend dynamics chart easier to read and switch weekly labels to English)
- Description: Refined the `Динамика трат` block so it reads more clearly at a glance. Weekly labels now use English weekday abbreviations instead of short Russian labels, which makes the week chart easier to parse visually. The panel also now explains the line better with a clearer subtitle and a compact summary strip under the chart showing the peak point, average value, and latest non-zero payment, so the user can understand the trend without guessing from the line alone.
- Date: 2026-03-27
- Diff sample:
```ts
import { enUS, ru } from "date-fns/locale";
```
```ts
label: format(bucketDate, "EEE", { locale: enUS }).toUpperCase(),
```
```tsx
<div className="mt-3 grid grid-cols-3 gap-2">
  {chartSummary.map((item) => (
    <ChartMetric key={item.label} label={item.label} value={item.value} />
  ))}
</div>
```

## 96) client/src/components/TravelStatsPanel.tsx (remove redundant 120 KZT hints and make the chart summary more meaningful)
- Description: Simplified the spend overview for a fixed-fare flow where each successful ride is always `120 ₸`. The top summary no longer shows `средний чек`, because it did not add useful information, and the small chip in the hero card now shows the latest active point instead of a redundant peak amount. The chart summary under `Динамика трат` was also redesigned to show clearer signals: `Пик`, `Оплат`, and `Последняя`, each with short helper text, so the block is easier to understand without repeating the fixed fare.
- Date: 2026-03-27
- Diff sample:
```tsx
<div className="mt-2 text-sm text-white/60">
  {formatPaymentCount(stats.rideCount)} {"\u0437\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434"}
</div>
```
```tsx
<ChartMetric
  key={item.label}
  label={item.label}
  value={item.value}
  hint={item.hint}
/>
```

## 97) client/src/components/TravelStatsPanel.tsx (replace remaining mojibake separators in travel stats with a proper bullet)
- Description: Cleaned up the last broken `вЂў` separators inside the travel statistics panel. Route summaries and the exact-payments list now use a normal bullet `•`, so the details under `Точные оплаты` and the route/plate hints render cleanly on the page instead of showing mojibake.
- Date: 2026-03-27
- Diff sample:
```tsx
{"\u041c\u0430\u0440\u0448\u0440\u0443\u0442"} {ride.route} {"\u2022"} {ride.plate}
```

## 98) client/src/pages/Home.tsx (make Manual mode collapsible and remove the duplicate chat-open button)
- Description: Reworked the `Ручной режим` card into a persistent collapsible block, matching the rest of the Home screen behavior. The open/closed state is now saved locally, so the card stays expanded or collapsed between visits. The duplicate bottom CTA for opening the manual chat was removed, leaving a single `В чат` action in the header while keeping the route, plate, Onay prefill, clear-history, and logout controls inside the animated expandable section.
- Date: 2026-03-27
- Diff sample:
```tsx
const HOME_MANUAL_OPEN_KEY = "ios_home_manual_open";
const [isManualPanelOpen, setIsManualPanelOpen] = useState(() => {
  const saved = window.localStorage.getItem(HOME_MANUAL_OPEN_KEY);
  return saved === null ? true : saved === "true";
});
```
```tsx
<AnimatePresence initial={false}>
  {isManualPanelOpen ? (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
```

## 99) client/src/pages/Home.tsx (fix Home card mojibake and keep manual actions visible outside the collapsible body)
- Description: Cleaned up the remaining broken Russian strings in the Home screen, especially around the API/Onay flow and remembered-password toasts. The `Ручной режим` header keeps the collapse button above the `В чат` button in a vertical stack, and the `Очистить историю` / `Выйти из аккаунта` actions stay outside the expandable body so they remain visible even when the manual block is collapsed.
- Date: 2026-03-27
- Diff sample:
```tsx
toast.error("Введите код терминала");
toast.success("Данные обновлены", {
  description: `${nextRoute}, ${nextPlate} - ${nextPrice}`,
});
```
```tsx
<div className="flex shrink-0 flex-col items-end gap-2">
  <button type="button">{isManualPanelOpen ? "Скрыть" : "Развернуть"}</button>
  <Button onClick={goManualChat}>{"В чат"}</Button>
</div>
```
```tsx
<div className="mt-4 space-y-2 border-t border-white/8 pt-4">
  <Button onClick={handleClearHistory}>{"Очистить историю"}</Button>
  <Button onClick={() => setShowLogoutConfirm(true)}>{"Выйти из аккаунта"}</Button>
</div>
```
