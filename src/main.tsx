import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installNetworkLockdown } from "./security/networkLockdown";
import "./styles.css";

if (import.meta.env.PROD) {
  installNetworkLockdown();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
