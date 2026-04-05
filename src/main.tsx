import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "modern-normalize/modern-normalize.css";
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
      <Tooltip.Provider delayDuration={300} skipDelayDuration={100}>
        <Page />
      </Tooltip.Provider>
    </QueryClientProvider>
  </StrictMode>,
);
