// MODIFIED BY AI: 2026-02-12 - add auth/admin routes with protected guards while keeping chat flow
// FILE: client/src/App.tsx

import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ChatProvider } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useMobile";
import Admin from "@/pages/Admin";
import Chat from "@/pages/Chat";
import DesktopOnly from "@/pages/DesktopOnly";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import QrPage from "@/pages/QrPage";
import { Route, Switch, useLocation } from "wouter";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-gray-400">Loading...</div>
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
  return (
    <ChatProvider>
      <Toaster />
      <Router />
    </ChatProvider>
  );
}

export default App;
