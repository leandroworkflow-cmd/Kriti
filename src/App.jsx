import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages
import Home from '@/pages/Home';
import Explore from '@/pages/Explore';
import Forums from '@/pages/Forums';
import Bookmarks from '@/pages/Bookmarks';
import NewThread from '@/pages/NewThread';
import ThreadDetail from '@/pages/ThreadDetail';
import Profile from '@/pages/Profile';
import UserProfilePage from '@/pages/UserProfile';
import Notifications from '@/pages/Notifications';
import IQTest from '@/pages/IQTest';
import GatewayCheck from '@/pages/GatewayCheck';
import AppLayout from '@/components/layout/AppLayout';
import AdminPanel from '@/pages/AdminPanel';
import Banned from '@/pages/Banned';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return <Login />;
  }

  return (
    <Routes>
      {/* Rotas públicas de autenticação */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Rotas que exigem usuário autenticado */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Login />} />}>
        {/* Destinos do gateway: não passam pelo GatewayCheck, senão criaria loop */}
        <Route path="/iq-test" element={<IQTest />} />
        <Route path="/banned" element={<Banned />} />

        {/* Rotas que exigem ter passado no teste de acesso (Kriti) */}
        <Route element={<GatewayCheck><Outlet /></GatewayCheck>}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/forums" element={<Forums />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/forums/:category/new" element={<NewThread />} />
            <Route path="/thread/:threadId" element={<ThreadDetail />} />
            <Route path="/user/:userId" element={<UserProfilePage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

// Garante que apenas usuários com role "admin" acessem o painel administrativo
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
          <Toaster />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
