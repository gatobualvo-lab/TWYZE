import React from 'react';

interface LoadingScreenProps {
  /** Renders as a compact inline block instead of taking over the full viewport — use inside a page that already has its own header/chrome. */
  fullScreen?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ fullScreen = true }) => {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100' : 'py-16'}`}>
      <div className="text-center">
        <div className="relative mb-5 w-16 h-16 mx-auto">
          <img
            src="/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png"
            alt="Trackwyze"
            className="w-16 h-16 mx-auto animate-rise"
          />
        </div>

        {fullScreen && (
          <>
            <h1 className="text-xl font-bold text-gray-800 mb-0.5">Trackwyze</h1>
            <p className="text-blue-600 text-sm font-medium mb-5">Track Smart. Profit Wise.</p>
          </>
        )}

        <div className="w-28 h-1 bg-blue-100 rounded-full mx-auto overflow-hidden">
          <div className="w-1/2 h-full bg-blue-600 rounded-full animate-loading-bar" />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;