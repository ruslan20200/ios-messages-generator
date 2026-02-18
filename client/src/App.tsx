// MODIFIED BY AI: 2026-02-12 - add auth/admin routes with protected guards while keeping chat flow
// FILE: client/src/App.tsx

import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { UpdateNotice } from "@/components/UpdateNotice";
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

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-5">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1218]/92 px-6 py-5 shadow-[0_14px_34px_rgba(0,0,0,0.42)] backdrop-blur-md">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ios-blue/18 text-ios-blue">
          <Spinner className="size-5" />
        </div>
        <div className="text-sm font-medium text-gray-200">Загрузка…</div>
        <div className="text-xs text-gray-400">Открываем приложение</div>
      </div>
    </div>
  );
}

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

  if (isLoading) return <LoadingScreen />;
  if (!user) return null;

  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && user && user.role !== "admin") {
      navigate("/chat?mode=api", { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) return <LoadingScreen />;
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

    if (user.role === "admin") {
      navigate("/admin", { replace: true });
      return;
    }

    navigate("/chat?mode=api", { replace: true });
  }, [isLoading, user, navigate]);

  return null;
}

function LoginRoute() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading || !user) return;

    navigate(user.role === "admin" ? "/admin" : "/chat?mode=api", {
      replace: true,
    });
  }, [isLoading, user, navigate]);

  if (isLoading) return <LoadingScreen />;
  if (user) return null;

  return <Login />;
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
    if (!shouldPrefetchLightRoutes()) return;

    const cancelIdle = runWhenIdle(() => {
      void loadLoginPage();
      void loadChatPage();
    });

    return () => {
      cancelIdle();
    };
  }, []);

  return (
    <ChatProvider>
      <Toaster />
      <UpdateNotice />
      <Suspense fallback={<LoadingScreen />}>
        <Router />
      </Suspense>
    </ChatProvider>
  );
}

export default App;
