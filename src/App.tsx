import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Header, TabBar } from './components';
import { LogPage, HistoryPage, SettingsPage, LoginPage, DesignPage } from './pages';

export const App: React.FC = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <>
      {!isLoginPage && <Header />}
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<LogPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/design" element={<DesignPage />} />
        </Routes>
      </main>

      {!isLoginPage && <TabBar />}
    </>
  );
};

export default App;
