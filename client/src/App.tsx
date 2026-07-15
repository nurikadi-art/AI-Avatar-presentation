import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { AppShell } from './components/AppShell';
import { useMe } from './api/queries';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { HomePage } from './pages/HomePage';
import { BoardPage } from './pages/BoardPage';
import { AdminPage } from './pages/AdminPage';
import { SettingsPage } from './pages/SettingsPage';
import { CardDetailRoute } from './components/card/CardDetailRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false },
  },
});

function ProtectedLayout() {
  const me = useMe();
  if (me.isPending) {
    return <div className="min-h-screen bg-cream" />;
  }
  if (me.isError || !me.data) {
    return <Navigate to="/login" replace />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/invite/:token" element={<AcceptInvitePage />} />
            <Route path="/reset/:token" element={<ResetPasswordPage />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/b/:boardId" element={<BoardPage />} />
              <Route
                path="/b/:boardId/c/:cardId"
                element={
                  <>
                    <BoardPage />
                    <CardDetailRoute />
                  </>
                }
              />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
