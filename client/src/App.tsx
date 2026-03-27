// MODIFIED BY AI: 2026-03-19 - remove startup boot/loading screen and keep initial render blank
// FILE: client/src/App.tsx

import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { UpdateNotice } from "@/components/UpdateNotice";
import { rememberLastAuthedRoute } from "@/lib/bootstrapRoute";
import { ChatProvider } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useMobile";
import { Route, Switch, useLocation } from "wouter";

const loadAdminPage = () => import("@/pages/Admin");
const loadChatPage = () => import("@/pages/Chat");
const loadDesktopOnlyPage = () => import("@/pages/DesktopOnly");
const loadHomePage = () => import("@/pages/Home");
const loadLoginPage = () => import("@/pages/Login");
const loadNotFoundPage = () => import("@/pages/NotFound");
const loadQrPage = () => import("@/pages/QrPage");

const Admin = lazy(loadAdminPage);
const Chat = lazy(loadChatPage);
const DesktopOnly = lazy(loadDesktopOnlyPage);
const Home = lazy(loadHomePage);
const Login = lazy(loadLoginPage);
const NotFound = lazy(loadNotFoundPage);
const QrPage = lazy(loadQrPage);

const runWhenIdle = (task: () => void): (() => void) => {
  const win = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof win.requestIdleCallback === "function") {
    const id = win.requestIdleCallback(task, { timeout: 1800 });
    return () => win.cancelIdleCallback?.(id);
  }

  const timeoutId = window.setTimeout(task, 250);
  return () => window.clearTimeout(timeoutId);
};

const shouldPrefetchLightRoutes = () => {
  const nav = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  };

  const connection = nav.connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") {
    return false;
  }
  return true;
};

function MobileOnly({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <DesktopOnly />;
  }

  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) return null;
  if (!user) return null;

  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && user && user.role !== "admin") {
      // MODIFIED BY AI: 2026-03-19 - return non-admin users to the shared home screen instead of forcing chat mode
      // FILE: client/src/App.tsx
      navigate("/home", { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) return null;
  if (!user || user.role !== "admin") return null;

  return <>{children}</>;
}

function RedirectRoot() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    // MODIFIED BY AI: 2026-03-19 - let admin accounts open the app like regular users and enter admin from Home
    // FILE: client/src/App.tsx
    navigate("/home", { replace: true });
  }, [isLoading, user, navigate]);

  return null;
}

function LoginRoute() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading || !user) return;

    // MODIFIED BY AI: 2026-03-19 - keep post-login landing shared for admin and regular users
    // FILE: client/src/App.tsx
    navigate("/home", { replace: true });
  }, [isLoading, user, navigate]);

  if (isLoading) return null;
  if (user) return null;

  return <Login />;
}

function RouteMemory() {
  const { user } = useAuth();
  const [location] = useLocation();

  useEffect(() => {
    if (!user) return;

    // MODIFIED BY AI: 2026-03-19 - remember the last authenticated route so offline restarts open the saved screen immediately
    // FILE: client/src/App.tsx
    const currentRoute = `${window.location.pathname}${window.location.search}`;
    rememberLastAuthedRoute(currentRoute, user.role);
  }, [location, user]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RedirectRoot} />
      <Route path="/login" component={LoginRoute} />
      <Route path="/admin">
        {() => (
          <AuthGuard>
            <AdminGuard>
              <Admin />
            </AdminGuard>
          </AuthGuard>
        )}
      </Route>
      <Route path="/chat">
        {() => (
          <AuthGuard>
            <MobileOnly>
              <Chat />
            </MobileOnly>
          </AuthGuard>
        )}
      </Route>
      <Route path="/home">
        {() => (
          <AuthGuard>
            <MobileOnly>
              <Home />
            </MobileOnly>
          </AuthGuard>
        )}
      </Route>
      <Route path="/qr/:code">
        {(params) => (
          <AuthGuard>
            <MobileOnly>
              <QrPage params={params} />
            </MobileOnly>
          </AuthGuard>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // MODIFIED BY AI: 2026-03-27 - move route warmup to browser idle after load so startup stays lighter without removing prefetching
    // FILE: client/src/App.tsx
    const cancelers: Array<() => void> = [];
    let cancelled = false;

    const startWarmup = () => {
      if (cancelled) return;

      cancelers.push(
        runWhenIdle(() => {
          void loadLoginPage();
          void loadHomePage();

          if (shouldPrefetchLightRoutes()) {
            void loadChatPage();
          }

          cancelers.push(
            runWhenIdle(() => {
              void loadAdminPage();
              void loadQrPage();
            }),
          );
        }),
      );
    };

    if (document.readyState === "complete") {
      startWarmup();
    } else {
      const handleLoad = () => startWarmup();
      window.addEventListener("load", handleLoad, { once: true });
      cancelers.push(() => window.removeEventListener("load", handleLoad));
    }

    return () => {
      cancelled = true;
      cancelers.forEach((cancel) => cancel());
    };
  }, []);

  return (
    <ChatProvider>
      <Toaster />
      <UpdateNotice />
      <RouteMemory />
      <Suspense fallback={null}>
        <Router />
      </Suspense>
    </ChatProvider>
  );
}

export default App;
