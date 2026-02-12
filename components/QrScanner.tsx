
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle } from 'lucide-react';

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader-container";
  const isMountedRef = useRef(false);
  const isStartingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    // 1. Initialize the scanner instance
    let html5QrCode: Html5Qrcode;
    try {
        html5QrCode = new Html5Qrcode(scannerContainerId, {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false
        });
        html5QrCodeRef.current = html5QrCode;
    } catch (e) {
        console.error("Failed to init Html5Qrcode", e);
        setError("שגיאה באתחול הסורק");
        return;
    }

    const startScanner = async () => {
      try {
        if (!isMountedRef.current) return;
        setIsInitializing(true);
        setError(null);
        isStartingRef.current = true;

        // Define constraints safely without 'as any'
        const videoConstraints = {
            facingMode: "environment",
            focusMode: "continuous"
        };

        const config = {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return { width: Math.floor(minEdge * 0.7), height: Math.floor(minEdge * 0.7) };
          },
          aspectRatio: 1.0,
          videoConstraints: videoConstraints
        };

        const onScanSuccess = (decodedText: string) => {
            if (html5QrCodeRef.current?.isScanning) {
               html5QrCodeRef.current.pause(); 
            }
            onScan(decodedText);
        };

        const onScanFailure = (error: any) => {
            // Ignore scan failures
        };

        // Logic to prioritize Back Camera
        try {
            // Attempt 1: Standard environment request
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                onScanSuccess,
                onScanFailure
            );
        } catch (err1) {
            console.warn("Standard environment request failed:", err1);
            if (!isMountedRef.current) return;

            // Attempt 2: Explicitly find a back camera
            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length) {
                    const backCamera = devices.find(d => {
                        const label = d.label.toLowerCase();
                        return label.includes('back') || label.includes('rear') || label.includes('environment');
                    });
                    
                    const cameraId = backCamera ? backCamera.id : devices[devices.length - 1].id;
                    
                    await html5QrCode.start(
                        cameraId,
                        config,
                        onScanSuccess,
                        onScanFailure
                    );
                } else {
                    throw new Error("No cameras found");
                }
            } catch (err2) {
                 console.error("Camera enumeration failed:", err2);
                 if (!isMountedRef.current) return;
                 // Final Fallback: User camera
                 await html5QrCode.start(
                    { facingMode: "user" }, 
                    config,
                    onScanSuccess,
                    onScanFailure
                );
            }
        }

        isStartingRef.current = false;
        if (isMountedRef.current) {
            setIsInitializing(false);
        }
      } catch (err: any) {
        console.error("Critical Scanner Error:", err);
        isStartingRef.current = false;
        if (isMountedRef.current) {
            setError("לא הצלחנו לפתוח את המצלמה. אנא ודאי שנתת הרשאות ושהמצלמה תקינה.");
            setIsInitializing(false);
        }
      }
    };

    const timer = setTimeout(() => {
        startScanner();
    }, 100);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      
      const cleanup = async () => {
         const scanner = html5QrCodeRef.current;
         if (!scanner) return;

         try {
             if (isStartingRef.current) {
                 await new Promise(resolve => setTimeout(resolve, 500));
             }
             if (scanner.isScanning) {
                 await scanner.stop();
             }
             scanner.clear();
         } catch (err) {
             console.error("Cleanup error:", err);
             try { scanner.clear(); } catch(e) {} 
         }
      };
      
      cleanup();
    };
  }, []); 

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 no-print">
      <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl relative border border-white/20">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-rose-500" />
            <h3 className="text-xl font-black font-heebo">סריקת פריט</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 min-h-[300px] flex flex-col items-center justify-center bg-slate-900 relative">
          {error ? (
            <div className="text-center p-8 space-y-4 bg-white rounded-[2rem] w-full animate-in zoom-in">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={32} />
              </div>
              <p className="text-gray-800 font-bold">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-rose-600 text-white px-8 py-3 rounded-xl font-black text-sm active:scale-95 transition-all"
              >
                רענן דף
              </button>
            </div>
          ) : (
            <div className="relative w-full aspect-square max-w-[350px] overflow-hidden rounded-[2.5rem] border-4 border-slate-800 shadow-inner bg-black">
              {isInitializing && (
                <div className="absolute inset-0 z-30 bg-slate-900 flex flex-col items-center justify-center gap-4">
                  <RefreshCw className="animate-spin text-rose-500" size={32} />
                  <p className="text-sm font-bold text-slate-400">מפעיל מצלמה אחורית...</p>
                </div>
              )}
              
              {!isInitializing && (
                <>
                  <div className="scanner-overlay"></div>
                  <div className="scanner-cutoff">
                    <div className="scanner-laser"></div>
                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-rose-500 rounded-tl-xl"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-rose-500 rounded-tr-xl"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-rose-500 rounded-bl-xl"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-rose-500 rounded-br-xl"></div>
                  </div>
                </>
              )}
              
              <div id="qr-reader-container" className="w-full h-full object-cover"></div>
            </div>
          )}
          {!error && !isInitializing && (
            <p className="mt-6 text-center text-sm font-bold text-slate-400 animate-pulse">כווני את המצלמה לברקוד</p>
          )}
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-gray-100">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg"
          >
            סגור סורק
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrScanner;
