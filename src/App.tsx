import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Header, TabBar, ProtectedRoute, InstallBanner } from './components';
import { LogPage, HistoryPage, SettingsPage, LoginPage, DesignPage } from './pages';
import { useAuth } from './lib/auth';
import { initOfflineSync } from './lib/offlineQueue';

export const App: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const showNav = Boolean(user && !isLoginPage);

  useEffect(() => {
    if (user) {
      const cleanup = initOfflineSync();
      return cleanup;
    }
  }, [user]);

  return (
    <>
      {showNav && <Header />}
      {showNav && <InstallBanner />}
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <LogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/design" element={<DesignPage />} />
        </Routes>
      </main>

      {showNav && <TabBar />}
    </>
  );
};

export default App;
