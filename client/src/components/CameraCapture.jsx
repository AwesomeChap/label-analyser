import { useState, useRef, useEffect } from 'react';

const MODAL_DURATION_MS = 200;

export function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, MODAL_DURATION_MS);
  };

  useEffect(() => {
    let stream = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => setError(err.message || 'Camera access denied'));

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
        handleClose();
      },
      'image/jpeg',
      0.9
    );
  };

  const overlayVisible = mounted && !closing;

  return (
    <div
      className={`fixed inset-0 overlay flex items-center justify-center z-[1000] p-3 sm:p-4 transition-all duration-200 ease-out ${
        overlayVisible ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'
      } ${closing ? 'pointer-events-none' : ''}`}
      onClick={handleClose}
    >
      <div
        className={`bg-surface border border-[var(--color-border-subtle)] rounded-2xl w-[calc(100vw-1.5rem)] max-w-[400px] max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden shadow-2xl transition-all duration-200 ease-out ${
          overlayVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-[var(--color-border-subtle)] min-w-0">
          <h3 className="m-0 text-base sm:text-lg font-semibold text-text truncate">Capture from camera</h3>
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted hover:text-error p-2 border-0 bg-transparent cursor-pointer transition-colors shrink-0"
            onClick={handleClose}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error ? (
          <p className="px-4 sm:px-5 py-4 text-error m-0 text-sm">{error}</p>
        ) : (
          <>
            <div className="aspect-[3/4] bg-bg flex-shrink min-h-0 relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="p-4 pt-4">
              <button
                type="button"
                className="w-full py-3 px-4 min-h-[48px] rounded-xl border-0 bg-accent text-bg font-semibold cursor-pointer hover:opacity-90 text-bg touch-manipulation"
                onClick={takePhoto}
              >
                Take photo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
