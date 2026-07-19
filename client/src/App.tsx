import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import FindingWorkflow from "./pages/FindingWorkflow";
import FindingsListPage from "./pages/FindingsListPage";
import SettingsPage from "./pages/SettingsPage";
import { PublicOnlyRoute, RequireAuth } from "./components/RouteGuards";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <Landing />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/findings/:owner/:repo/:findingId"
        element={
          <RequireAuth>
            <FindingWorkflow />
          </RequireAuth>
        }
      />
      <Route
        path="/repos/:owner/:repo/findings"
        element={
          <RequireAuth>
            <FindingsListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
