// MODIFIED BY AI: 2026-02-12 - wrap app with AuthProvider for login/session state
// FILE: client/src/main.tsx

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootstrapClientRoute } from "@/lib/bootstrapRoute";
import "./index.css";
import App from "./App";
import { registerSW } from "virtual:pwa-register";
import { AuthProvider } from "@/contexts/AuthContext";

// MODIFIED BY AI: 2026-03-19 - restore the last saved route before React mounts so cached chat/home screens open instantly
// FILE: client/src/main.tsx
bootstrapClientRoute();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

registerSW({ immediate: true });
