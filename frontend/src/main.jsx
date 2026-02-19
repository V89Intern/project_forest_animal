import React, { useState, useEffect, createContext, useContext } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ForestPage } from "./pages/ForestPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { OperatorPage } from "./pages/OperatorPage.jsx";
import { ScanPage } from "./pages/ScanPage.jsx";
import "./styles/forest.css";
import "./styles/login.css";
import "./styles/operator.css";
import "./styles/scan.css";

/** Auth context — provides `user` and `logout` to the entire app. */
export const AuthContext = createContext({ user: null, logout: () => {} });
export function useAuth() {
  return useContext(AuthContext);
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("forest_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  function handleLogin(u) {
    setUser(u);
  }

  function logout() {
    sessionStorage.removeItem("forest_user");
    setUser(null);
  }

  // Not logged in → always show LoginPage
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/forest" element={<ForestPage />} />
          <Route path="/operator" element={<OperatorPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
