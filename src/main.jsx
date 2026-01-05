// src/main.jsx (or src/index.jsx)
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import App from "./pages/App.jsx";
import NormalAnalysis from "./pages/NormalAnalysis.jsx";
import YouTubeAnalysis from "./pages/YouTubeAnalysis.jsx";
import NewsTabs from "./pages/news/NewsTabs.jsx";
import LiveNews from "./pages/LiveNews.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route path="/" element={<App />} />

        <Route path="/live" element={<LiveNews />} />

        {/* YouTube */}
        <Route path="/youtube" element={<YouTubeAnalysis />} />

        {/* News */}
        <Route path="/news" element={<NewsTabs />} />

        {/* Normal */}
        <Route path="/normal" element={<NormalAnalysis />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
