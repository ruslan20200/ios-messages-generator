// MODIFIED BY AI: 2026-03-19 - bootstrap the last saved authenticated route before React mounts for faster offline entry
// FILE: client/src/lib/bootstrapRoute.ts

export const AUTH_USER_CACHE_STORAGE_KEY = "ios_msg_auth_user_cache";
export const APP_LAST_ROUTE_STORAGE_KEY = "ios_msg_last_route";

type CachedUserRole = "admin" | "user";

type CachedUser = {
  role: CachedUserRole;
};

const readCachedUser = (): CachedUser | null => {
  try {
    const raw = localStorage.getItem(AUTH_USER_CACHE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedUser>;
    if (parsed.role !== "admin" && parsed.role !== "user") {
      return null;
    }

    return { role: parsed.role };
  } catch {
    return null;
  }
};

const isAllowedRouteForRole = (route: string, role: CachedUserRole) => {
  if (role === "admin") {
    // MODIFIED BY AI: 2026-03-19 - keep admin startup inside the normal app flow; admin panel stays an explicit destination from Home
    // FILE: client/src/lib/bootstrapRoute.ts
    return (
      route.startsWith("/chat") ||
      route.startsWith("/home") ||
      route.startsWith("/qr/")
    );
  }

  return route.startsWith("/chat") || route.startsWith("/home") || route.startsWith("/qr/");
};

export const rememberLastAuthedRoute = (route: string, role: CachedUserRole) => {
  if (!route || !isAllowedRouteForRole(route, role)) return;
  localStorage.setItem(APP_LAST_ROUTE_STORAGE_KEY, route);
};

export const resolveBootstrapRoute = () => {
  if (typeof window === "undefined") return null;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath !== "/") {
    return null;
  }

  const cachedUser = readCachedUser();
  if (!cachedUser) {
    return "/login";
  }

  const savedRoute = localStorage.getItem(APP_LAST_ROUTE_STORAGE_KEY) || "";
  if (savedRoute && isAllowedRouteForRole(savedRoute, cachedUser.role)) {
    return savedRoute;
  }

  // MODIFIED BY AI: 2026-03-19 - default both roles to the shared home screen on fresh startup
  // FILE: client/src/lib/bootstrapRoute.ts
  return "/home";
};

export const bootstrapClientRoute = () => {
  const targetRoute = resolveBootstrapRoute();
  if (!targetRoute || targetRoute === window.location.pathname + window.location.search) {
    return;
  }

  window.history.replaceState(null, "", targetRoute);
};
