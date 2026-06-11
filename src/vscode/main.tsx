import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installNetworkLockdown } from "../security/networkLockdown";
import { VsCodePreviewApp } from "./VsCodePreviewApp";
import "../styles.css";
import "./vscode.css";

installNetworkLockdown();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VsCodePreviewApp />
  </StrictMode>,
);
