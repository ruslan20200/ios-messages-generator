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
