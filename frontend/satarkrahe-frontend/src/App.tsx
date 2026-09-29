import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import AnalyzePage from "./pages/AnalyzePage";
import HomePage from "./pages/HomePage";
import MonitorPage from "./pages/MonitorPage";

function NotFoundPage() {
  return (
    <section className="route-page" aria-labelledby="page-title">
      <p className="eyebrow">SYSTEM ROUTE / 404</p>
      <h1 className="page-title" id="page-title">ROUTE NOT FOUND</h1>
      <p className="text-muted-foreground">The requested path is not registered.</p>
    </section>
  );
}

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
