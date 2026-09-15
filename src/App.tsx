import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase, refreshSession } from './utils/supabase';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { identifyUser, resetAnalyticsIdentity } from './lib/analytics';

const LandingPage = lazy(() => import('./components/LandingPage'));
const EnhancedAuthScreen = lazy(() => import('./components/EnhancedAuthScreen'));
const ForgotPasswordPage = lazy(() => import('./components/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AdminRoute = lazy(() => import('./routes/AdminRoute'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const TermsOfService = lazy(() => import('./components/legal/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy'));
const RefundPolicy = lazy(() => import('./components/legal/RefundPolicy'));
const HelpCenter = lazy(() => import('./components/help/HelpCenter'));

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        try {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            const refreshResult = await refreshSession();
            if (!refreshResult.success) {
              setSession(null);
              return;
            }
            setSession(refreshResult.data.session);
          } else {
            setSession(session);
          }
        } catch (authError: any) {
          setSession(null);
          return;
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, newSession) => {
            setSession(newSession);

            if (newSession?.user) {
              identifyUser(newSession.user.id);
            }

            if (event === 'SIGNED_OUT') {
              resetAnalyticsIdentity();
              localStorage.removeItem('sb-trackwyze-auth');
              sessionStorage.removeItem('sb-trackwyze-auth');
            }
          }
        );
        return () => subscription.unsubscribe();
      } catch (err: any) {
        setSession(null);
      } finally {
        setInitializing(false);
      }
    };

    checkAuth();
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <img 
            src="/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png" 
            alt="Trackwyze Logo" 
            className="w-16 h-16 mx-auto mb-4 animate-pulse"
          />
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Trackwyze</h1>
          <p className="text-blue-600 font-medium">Track Smart. Profit Wise.</p>
          <div className="mt-4 w-8 h-1 bg-blue-200 rounded-full mx-auto overflow-hidden">
            <div className="w-full h-full bg-blue-600 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <ErrorBoundary>
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route
              path="/landing"
              element={<LandingPage />}
            />
            <Route
              path="/login"
              element={<EnhancedAuthScreen />}
            />
            <Route
              path="/forgot-password"
              element={<ForgotPasswordPage />}
            />
            <Route
              path="/reset-password"
              element={<ResetPasswordPage />}
            />
            <Route
              path="/terms"
              element={<TermsOfService />}
            />
            <Route
              path="/privacy"
              element={<PrivacyPolicy />}
            />
            <Route
              path="/refund"
              element={<RefundPolicy />}
            />
            <Route
              path="/help"
              element={<HelpCenter />}
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              }
            />
            <Route
              path="/app"
              element={session ? <Dashboard /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/account"
              element={session ? <Dashboard activeTab="account" /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/payment-management"
              element={session ? <Dashboard activeTab="payment-management" /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/*"
              element={session ? <Dashboard /> : <Navigate to="/landing" replace />}
            />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
