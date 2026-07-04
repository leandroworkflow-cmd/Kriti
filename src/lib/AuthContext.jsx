import { db } from "@/lib/db";
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadUser = async () => {
    try {
      const currentUser = await db.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    // Checagem inicial da sessão
    loadUser();

    // Mantém o estado em sincronia com login/logout/refresh de token do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    db.auth.logout("/login");
  };

  const navigateToLogin = () => {
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      // Mantidos por compatibilidade com telas que ainda leem esses campos
      isLoadingPublicSettings: false,
      authError,
      authChecked: !isLoadingAuth,
      logout,
      navigateToLogin,
      checkUserAuth: loadUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
