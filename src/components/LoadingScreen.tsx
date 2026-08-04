import React from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        {/* Animated TrackWyze Logo */}
        <div className="relative mb-4">
          <img 
            src="/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png" 
            alt="Trackwyze Logo" 
            className="w-20 h-20 mx-auto animate-pulse"
          />
          {/* Animated arrow overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-blue-600 animate-bounce" style={{
              animation: 'bounce 2s infinite, rise 2s ease-in-out infinite'
            }} />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Trackwyze</h1>
        <p className="text-blue-600 font-medium mb-4">Track Smart. Profit Wise.</p>
        
        {/* Custom loading animation */}
        <div className="mt-6 w-12 h-1 bg-blue-200 rounded-full mx-auto overflow-hidden">
          <div className="w-full h-full bg-blue-600 rounded-full animate-pulse" style={{
            animation: 'loading 1.5s ease-in-out infinite'
          }}></div>
        </div>
        
        <div className="flex items-center justify-center gap-2 mt-3">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <p className="text-sm text-gray-600">Loading your business data...</p>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes rise {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;