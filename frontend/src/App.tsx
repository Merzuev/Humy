import React from 'react';
import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { logger } from './utils/logger';
import './i18n';

// Lazy load components for better performance
const LoginForm = lazy(() => import('./components/auth/LoginForm').then(module => ({ default: module.LoginForm })));
const RegisterForm = lazy(() => import('./components/auth/RegisterForm').then(module => ({ default: module.RegisterForm })));
const ProfileSetupForm = lazy(() => import('./components/profile/ProfileSetupForm').then(module => ({ default: module.ProfileSetupForm })));
const MainDashboard = lazy(() => import('./components/dashboard/MainDashboard').then(module => ({ default: module.MainDashboard })));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-white">Loading...</p>
    </div>
  </div>
);

function App() {
  // Log app initialization
  React.useEffect(() => {
    logger.info('App initialized', {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  }, []);

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error('App-level error caught by ErrorBoundary', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack
        });
      }}
    >
      <UserProvider>
        <Router>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/login" element={
                <ErrorBoundary>
                  <LoginForm />
                </ErrorBoundary>
              } />
              <Route path="/register" element={
                <ErrorBoundary>
                  <RegisterForm />
                </ErrorBoundary>
              } />
              <Route 
                path="/setup-profile" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <ProfileSetupForm />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <MainDashboard />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </UserProvider>
    </ErrorBoundary>
  );
}

export default App;