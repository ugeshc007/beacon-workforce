import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { hydrateSessionFromPreferences } from "@/lib/mobile-session-persist";

// Restore any mirrored Supabase session into localStorage BEFORE the app boots
// so supabase-js picks it up on cold start (important for native Capacitor where
// the WebView may have cleared localStorage).
hydrateSessionFromPreferences().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
