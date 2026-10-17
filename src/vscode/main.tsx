import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startAutomationRenderer } from "../rendering/automationRenderer";
import { installNetworkLockdown } from "../security/networkLockdown";
import { VsCodePreviewApp } from "./VsCodePreviewApp";
import "../styles.css";
import "./vscode.css";

installNetworkLockdown();

if (document.body.dataset.automation === "true") {
  startAutomationRenderer();
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <VsCodePreviewApp />
    </StrictMode>,
  );
}
