import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import * as Tone from "tone";
import { engine } from "./audio/engine";
import { useStore } from "./state/store";

// Dev-only handle for debugging/e2e (stripped from production builds).
if (import.meta.env.DEV) Object.assign(window, { __mm: { engine, useStore, Tone } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
