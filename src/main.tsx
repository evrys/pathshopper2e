import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { SharedList } from "./components/SharedList.tsx";
import "./global.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

const queryClient = new QueryClient();

const isSharedList =
  new URLSearchParams(window.location.search).get("view") === "list";
const Page = isSharedList ? SharedList : App;

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Page />
    </QueryClientProvider>
  </StrictMode>,
);
