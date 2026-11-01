/** Routes: / (home), /login, /signup, /profile (auth), /analyze (auth). */
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AnalyzePage from "./pages/AnalyzePage";
import DatasetViewPage from "./pages/DatasetViewPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import SignupPage from "./pages/SignupPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/analyze" element={<ProtectedRoute><AnalyzePage /></ProtectedRoute>} />
      <Route path="/dataset/:id" element={<ProtectedRoute><DatasetViewPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
