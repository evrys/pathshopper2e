import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { SharedList } from "./components/SharedList.tsx";
import "./global.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const path = window.location.pathname.replace(base, "").replace(/\/$/, "");
const Page = path === "/list" ? SharedList : App;

createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
