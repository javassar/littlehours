import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Header, TabBar, ProtectedRoute, InstallBanner, DemoBanner } from './components';
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
    <div className="app-wrapper">
      {showNav && <Header />}
      {showNav && user?.is_anonymous && <DemoBanner />}
      {showNav && !user?.is_anonymous && <InstallBanner />}
      
      <main
        className="app-main pb-28"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
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
    </div>
  );
};

export default App;
