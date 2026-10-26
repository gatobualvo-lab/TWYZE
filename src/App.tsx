import LoadingScreen from './components/LoadingScreen';
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

const LazyFallback = () => <LoadingScreen variant="splash" />;

// Dark "ink" toasts with brand-coloured icons, instead of react-hot-toast's plain white boxes.
export const TOAST_OPTIONS = {
  duration: 3500,
  style: {
    background: '#0f1b2d',
    color: '#e8f3f0',
    borderRadius: '16px',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 500,
    boxShadow: '0 16px 32px -8px rgba(6, 16, 15, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    maxWidth: '420px',
  },
  success: { iconTheme: { primary: '#34d399', secondary: '#0f1b2d' } },
  error: { iconTheme: { primary: '#ff7a7a', secondary: '#0f1b2d' } },
  loading: { iconTheme: { primary: '#34d399', secondary: '#0f1b2d' } },
} as const;

// Forms that still use the browser's own "required" checks (and have no custom error
// handling) get the same red error state as the rest of the app. Only fields flagged here
// are cleared here, so fields controlled by a form's own error state are never touched.
function useNativeInvalidStyling() {
  useEffect(() => {
    const mark = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el || el.getAttribute('aria-invalid') === 'true') return;
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('data-native-invalid', '1');
    };
    const unmark = (e: Event) => {
      const el = e.target as (HTMLInputElement & HTMLElement) | null;
      if (!el?.getAttribute || el.getAttribute('data-native-invalid') !== '1') return;
      if (el.validity?.valid) {
        el.removeAttribute('aria-invalid');
        el.removeAttribute('data-native-invalid');
      }
    };
    document.addEventListener('invalid', mark, true);
    document.addEventListener('input', unmark, true);
    document.addEventListener('change', unmark, true);
    return () => {
      document.removeEventListener('invalid', mark, true);
      document.removeEventListener('input', unmark, true);
      document.removeEventListener('change', unmark, true);
    };
  }, []);
}

const App = () => {
  useNativeInvalidStyling();
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
    return <LoadingScreen variant="splash" />;
  }

  return (
    <BrowserRouter>
      <Toaster
        position="bottom-center"
        containerStyle={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}
        toastOptions={TOAST_OPTIONS}
      />
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
