import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ForestPage } from "./pages/ForestPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { OperatorPage } from "./pages/OperatorPage.jsx";
import { ScanPage } from "./pages/ScanPage.jsx";
import "./styles/forest.css";
import "./styles/operator.css";
import "./styles/scan.css";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/forest" element={<ForestPage />} />
      <Route path="/operator" element={<OperatorPage />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </React.StrictMode>
  );
}
