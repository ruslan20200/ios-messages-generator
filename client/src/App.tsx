import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ChatProvider } from "@/contexts/ChatContext";
import { useIsMobile } from "@/hooks/useMobile";
import Chat from "@/pages/Chat";
import DesktopOnly from "@/pages/DesktopOnly";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import QrPage from "@/pages/QrPage";
import { Route, Switch, useLocation } from "wouter";

function RedirectToChat() {
  const [, navigate] = useLocation();

  // Send users straight into chat with api mode by default
  useEffect(() => {
    navigate("/chat?mode=api");
  }, [navigate]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RedirectToChat} />
      <Route path="/chat" component={Chat} />
      <Route path="/home" component={Home} />
      <Route path="/qr/:code" component={QrPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const isMobile = useIsMobile();

  // Show desktop message if not mobile
  if (isMobile === false) {
    return <DesktopOnly />;
  }

  // Show loading state while detecting device
  if (isMobile === undefined) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  // Show mobile app
  return (
    <ChatProvider>
      <Toaster />
      <Router />
    </ChatProvider>
  );
}

export default App;
