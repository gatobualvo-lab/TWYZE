import { createClient } from '@supabase/supabase-js';
import { Database } from '../lib/database.types';
import toast from 'react-hot-toast';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Environment check:', {
  NODE_ENV: import.meta.env.MODE,
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlValue: supabaseUrl,
  keyPrefix: supabaseAnonKey?.slice(0, 20)
});

// Validate environment variables
if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL environment variable');
  console.error('Available env vars:', Object.keys(import.meta.env));
  throw new Error('Missing VITE_SUPABASE_URL environment variable. Please check your .env file.');
}

if (!supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
  console.error('Available env vars:', Object.keys(import.meta.env));
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable. Please check your .env file.');
}

if (supabaseAnonKey.includes('example') || supabaseAnonKey.includes('your_real_anon_key_here')) {
  console.error('❌ Placeholder API key detected. Please replace with actual Supabase anon key.');
  throw new Error('Invalid VITE_SUPABASE_ANON_KEY: Please replace the placeholder with your actual Supabase anonymous key.');
}

// Helper function to handle auth errors and redirect if needed
const handleAuthError = (error: any) => {
  console.error('Auth error:', error);
  
  // Check if it's a refresh token error
  if (error.message?.includes('Invalid Refresh Token') || 
      error.message?.includes('Refresh Token Not Found') ||
      error.message?.includes('JWT expired')) {
    
    // Clear any stored tokens
    localStorage.removeItem('sb-trackwyze-auth');
    sessionStorage.removeItem('sb-trackwyze-auth');
    
    // Show error message
    toast.error('Your session has expired. Please log in again.');
    
    // Redirect to login page
    window.location.href = '/login';
    
    return true; // Error was handled
  }
  
  return false; // Error wasn't handled
};

console.log('✅ Supabase URL:', supabaseUrl);
console.log('✅ Supabase Key (first 20 chars):', supabaseAnonKey.slice(0, 20) + '...');

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true, // This enables automatic token refresh
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'sb-trackwyze-auth'
    }
  }
);

// Add auth state change listener to handle token refresh
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('✅ Token refreshed successfully');
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    // Clear any stored tokens
    localStorage.removeItem('sb-trackwyze-auth');
    sessionStorage.removeItem('sb-trackwyze-auth');
  }
});

// Test Supabase connection
export const testSupabaseConnection = async () => {
  try {
    console.log('🔌 Testing Supabase connection...');
      
    const { data, error } = await supabase.auth.getSession()
      .catch(err => {
        handleAuthError(err);
        return { data: null, error: err };
      });
    
    if (error) {
      const handled = handleAuthError(error);
      if (!handled) {
        console.error('❌ Supabase connection failed:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }
    }
    
    console.log('✅ Supabase connection successful');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Supabase connection test exception:', error);
    handleAuthError(error);
    return { 
      success: false, 
      error: error.message || 'Unknown error during connection test' 
    };
  }
};

// Helper function to refresh session
export const refreshSession = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      handleAuthError(error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error: any) {
    handleAuthError(error);
    return { success: false, error };
  }
};