import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import AnalyzePage from "./pages/AnalyzePage";
import HomePage from "./pages/HomePage";
import MonitorPage from "./pages/MonitorPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="analyze" element={<AnalyzePage />} />
          <Route path="monitor" element={<MonitorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
