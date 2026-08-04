import React from 'react';
import { X, Download, Smartphone, Share, PlusSquare, CheckCircle2, Monitor } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import toast from 'react-hot-toast';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose }) => {
  const { platform, isInstalled, canPrompt, promptInstall } = usePwaInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const { outcome } = await promptInstall();
    if (outcome === 'accepted') {
      toast.success('Trackwyze installed successfully');
      onClose();
    } else if (outcome === 'unavailable') {
      toast('Tap your browser menu and choose "Install app" or "Add to Home screen"', {
        icon: 'i',
        duration: 5000,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-600 p-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Download className="w-5 h-5" />
            Install Trackwyze
          </h2>
          <button onClick={onClose} className="text-white hover:text-blue-200" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {isInstalled ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-800 mb-1">App already installed</h3>
              <p className="text-sm text-gray-600">
                You're using the installed Trackwyze app. Enjoy the full-screen experience.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700 mb-4">
                Install Trackwyze on your device for a faster, full-screen experience that works
                offline and launches from your home screen.
              </p>

              {(platform === 'android' || platform === 'desktop') && (
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    {platform === 'android' ? (
                      <Smartphone className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Monitor className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm text-gray-800 mb-1">
                        {platform === 'android' ? 'Install on Android' : 'Install on this device'}
                      </h3>
                      <p className="text-xs text-gray-600 mb-3">
                        Tap install to add Trackwyze to your home screen.
                      </p>
                      <button
                        onClick={handleInstallClick}
                        disabled={!canPrompt}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors w-full"
                      >
                        {canPrompt ? 'Install App' : 'Install not available yet'}
                      </button>
                      {!canPrompt && (
                        <p className="text-xs text-gray-500 mt-2">
                          If the install button is disabled, open your browser menu and choose
                          "Install app" or "Add to Home screen".
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {platform === 'ios' && (
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Smartphone className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-sm text-gray-800">Install on iPhone or iPad</h3>
                      <p className="text-xs text-gray-600">
                        Open this site in Safari, then follow the steps below.
                      </p>
                    </div>
                  </div>
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">
                        1
                      </span>
                      <span className="flex items-center gap-2">
                        Tap the Share icon
                        <Share className="w-4 h-4 text-blue-600" />
                        in Safari's toolbar.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">
                        2
                      </span>
                      <span className="flex items-center gap-2">
                        Choose "Add to Home Screen"
                        <PlusSquare className="w-4 h-4 text-blue-600" />.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">
                        3
                      </span>
                      <span>Tap "Add". Trackwyze will appear on your home screen.</span>
                    </li>
                  </ol>
                </div>
              )}

              {platform === 'unknown' && (
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-700">
                    Open Trackwyze in your mobile browser, then choose "Install app" or
                    "Add to Home screen" from the browser menu.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs text-blue-900">
                  Trackwyze is a Progressive Web App. Once installed it works like a native app
                  with offline support, fast launch, and home-screen access on Android and iOS.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-50 p-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
