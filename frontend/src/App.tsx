import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { MainLayout } from './layouts/MainLayout';

// Auth Pages
import { Login } from './pages/auth/Login';
import { AdminLogin } from './pages/auth/AdminLogin';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';

// Workspace Pages
import { Dashboard } from './pages/dashboard/Dashboard';
import { Documents } from './pages/documents/Documents';
import { Folders } from './pages/folders/Folders';
import { Recent } from './pages/recent/Recent';
import { Favorites } from './pages/favorites/Favorites';
import { SharedWithMe } from './pages/shared/SharedWithMe';
import { Trash } from './pages/trash/Trash';
import { AISearch } from './pages/search/Search';
import { ActivityPage } from './pages/activity/Activity';
import { Profile } from './pages/profile/Profile';
import { Settings } from './pages/settings/Settings';

// Admin
import { Admin } from './pages/admin/Admin';

const ProtectedPage: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => (
  <PrivateRoute requireAdmin={adminOnly}>
    <MainLayout>
      {children}
    </MainLayout>
  </PrivateRoute>
);

const App: React.FC = () => {
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const savedDensity = localStorage.getItem('density');
    if (savedDensity === 'compact') {
      document.documentElement.classList.add('compact-density');
    } else {
      document.documentElement.classList.remove('compact-density');
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Workspace Routes */}
          <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
          <Route path="/documents" element={<ProtectedPage><Documents /></ProtectedPage>} />
          <Route path="/folders" element={<ProtectedPage><Folders /></ProtectedPage>} />
          <Route path="/recent" element={<ProtectedPage><Recent /></ProtectedPage>} />
          <Route path="/favorites" element={<ProtectedPage><Favorites /></ProtectedPage>} />
          <Route path="/shared-with-me" element={<ProtectedPage><SharedWithMe /></ProtectedPage>} />
          <Route path="/trash" element={<ProtectedPage><Trash /></ProtectedPage>} />
          <Route path="/search" element={<ProtectedPage><AISearch /></ProtectedPage>} />
          <Route path="/activity" element={<ProtectedPage><ActivityPage /></ProtectedPage>} />
          <Route path="/profile" element={<ProtectedPage><Profile /></ProtectedPage>} />
          <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />

          {/* Admin Only */}
          <Route path="/admin" element={<ProtectedPage adminOnly><Admin /></ProtectedPage>} />

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
