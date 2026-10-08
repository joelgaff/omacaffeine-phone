import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Tracker } from "@/components/tracker";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Tracker />
  </StrictMode>,
);
