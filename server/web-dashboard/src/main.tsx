import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";
import "./sw-register";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <BrowserRouter basename="/dashboard">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
