import React, { useEffect, useRef, useState } from 'react';
import { X, ScanLine } from 'lucide-react';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

/** True where the browser can read barcodes from the camera (Chrome/Edge on Android and desktop; not iPhone Safari). */
export function isCameraScanSupported(): boolean {
  return !!getDetectorCtor() && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

interface CameraBarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({ onDetected, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const start = async () => {
      const Detector = getDetectorCtor();
      if (!Detector) {
        setError('Camera scanning is not supported in this browser. Use a barcode scanner or type the code instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector = new Detector();
        const tick = async () => {
          if (cancelled) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0 && codes[0].rawValue) {
              cancelled = true;
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {
            // A failed frame is not fatal; try the next one.
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch {
        setError('Could not open the camera. Allow camera access, or use a barcode scanner instead.');
      }
    };
    start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <ScanLine className="w-4 h-4" /> Scan a barcode
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close scanner">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : (
          <div className="relative bg-black">
            <video ref={videoRef} playsInline muted className="w-full max-h-[60vh] object-cover" />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-white/80 rounded-lg" />
          </div>
        )}
        <p className="px-4 py-3 text-xs text-gray-500">Hold the barcode inside the box. It is read automatically.</p>
      </div>
    </div>
  );
};

export default CameraBarcodeScanner;
