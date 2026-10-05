import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ativarAuditoriaAutomatica } from "./lib/auditoriaAutomatica";

ativarAuditoriaAutomatica();

createRoot(document.getElementById("root")!).render(<App />);
