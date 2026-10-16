import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installNetworkLockdown } from "../security/networkLockdown";
import { VsCodeControlsApp } from "./VsCodeControlsApp";
import "./controls.css";

installNetworkLockdown();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VsCodeControlsApp />
  </StrictMode>,
);
