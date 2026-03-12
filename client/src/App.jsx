import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const API_BASE = '/api';

function GlassyModal({ open, onClose, children, className = '', bare = false }) {
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
  };

  const handleExitAnimationEnd = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.animationName === 'modal-panel-out') {
      onClose();
      setClosing(false);
    }
  };

  if (!open && !closing) return null;

  const closingClass = closing ? ' closing' : '';

  const modal = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center modal-backdrop${closingClass}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        minWidth: '100%',
        minHeight: '100%',
        background: 'rgba(11, 13, 20, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`overflow-hidden modal-panel${closingClass} ${bare ? '' : 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]'} ${className}`}
        style={bare ? undefined : {
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={closing ? handleExitAnimationEnd : undefined}
      >
        {typeof children === 'function' ? children(handleClose) : children}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function ImagePreviewModal({ open, imageUrl, onClose, onDelete }) {
  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <GlassyModal
      open={open && !!imageUrl}
      onClose={onClose}
      bare
      className="max-w-[90vw] max-h-[90vh]"
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <img
          src={imageUrl}
          alt="Preview"
          className="max-w-full max-h-[90vh] w-auto h-auto object-contain block"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-lg bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/90 transition-colors duration-200"
          aria-label="Close preview"
        >
          <span className="text-lg leading-none">×</span>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="absolute top-3 right-14 z-10 w-9 h-9 rounded-lg bg-black/50 hover:bg-rose-500/80 flex items-center justify-center text-white/90 transition-colors duration-200"
          aria-label="Remove image"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </GlassyModal>
  );
}

function ImageWithBoxes({ imageUrl, textBlocks, className = '', imgClassName = '' }) {
  const [dimensions, setDimensions] = useState(null);
  const imgRef = useRef(null);

  const onLoad = () => {
    if (imgRef.current) {
      const { naturalWidth, naturalHeight, offsetWidth, offsetHeight } = imgRef.current;
      setDimensions({ w: offsetWidth, h: offsetHeight, nw: naturalWidth, nh: naturalHeight });
    }
  };

  function normalizeBbox(bbox, naturalWidth, naturalHeight) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return null;
    const nums = bbox.map((n) => Number(n));
    if (nums.some((n) => Number.isNaN(n))) return null;
    let [a, b, c, d] = nums;
    const hasPixelCoords = naturalWidth > 0 && naturalHeight > 0 && Math.max(a, b, c, d) > 1;
    let xMin, yMin, xMax, yMax;
    if (hasPixelCoords) {
      const likelyWidthHeight = c > 0 && d > 0 && c <= naturalWidth && d <= naturalHeight && c < a && d < b;
      if (likelyWidthHeight) {
        xMin = a / naturalWidth;
        yMin = b / naturalHeight;
        xMax = (a + c) / naturalWidth;
        yMax = (b + d) / naturalHeight;
      } else {
        xMin = a / naturalWidth;
        yMin = b / naturalHeight;
        xMax = c / naturalWidth;
        yMax = d / naturalHeight;
      }
    } else {
      xMin = a;
      yMin = b;
      xMax = c;
      yMax = d;
    }
    xMin = Math.max(0, Math.min(1, xMin));
    yMin = Math.max(0, Math.min(1, yMin));
    xMax = Math.max(0, Math.min(1, xMax));
    yMax = Math.max(0, Math.min(1, yMax));
    if (xMin > xMax) [xMin, xMax] = [xMax, xMin];
    if (yMin > yMax) [yMin, yMax] = [yMax, yMin];
    if (xMax <= xMin || yMax <= yMin) return null;
    return [xMin, yMin, xMax, yMax];
  }

  const validBlocks =
    dimensions && (textBlocks || []).length > 0
      ? (textBlocks || [])
          .map((b) => ({ ...b, bbox: normalizeBbox(b.bbox, dimensions.nw, dimensions.nh) }))
          .filter((b) => b.bbox != null)
      : [];

  return (
    <div className={`relative inline-block max-w-full ${className}`}>
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Label"
        className={`max-w-full h-auto block ${imgClassName}`}
        onLoad={onLoad}
      />
      {dimensions && validBlocks.length > 0 && (
        <div
          className="absolute left-0 top-0 pointer-events-none"
          style={{ width: dimensions.w, height: dimensions.h }}
        >
          {validBlocks.map((block, i) => {
            const [xMin, yMin, xMax, yMax] = block.bbox;
            return (
              <div
                key={i}
                className="absolute border-2 border-[var(--accent)] bg-[var(--accent-dim)] box-border"
                style={{
                  left: `${xMin * 100}%`,
                  top: `${yMin * 100}%`,
                  width: `${(xMax - xMin) * 100}%`,
                  height: `${(yMax - yMin) * 100}%`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProviderResult({ name, result, imageUrl, isError, onImageClick }) {
  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-950/15 p-6 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-rose-300/90 mb-2">{name}</h3>
        <p className="text-rose-200/70 text-sm">{result?.error || 'Request failed'}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 backdrop-blur-sm shadow-lg" style={{ boxShadow: '0 4px 24px -4px var(--glow-subtle)' }}>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{name}</h3>
      <div>
        <p className="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-widest font-medium">Image with bounding boxes</p>
        <button
          type="button"
          onClick={() => onImageClick?.(imageUrl, result?.textBlocks)}
          className="block w-full text-left rounded-xl overflow-hidden border border-transparent hover:border-[var(--border-default)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--bg-card)] transition-colors cursor-pointer"
        >
          <ImageWithBoxes imageUrl={imageUrl} textBlocks={result?.textBlocks} />
        </button>
      </div>
    </div>
  );
}

function ExtractedTextComparison({ openaiText, googleText }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-medium">Extracted text (compare both)</p>
      <div
        className="overflow-auto max-h-80 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base-soft)]/80"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 min-h-min divide-x divide-[var(--border-subtle)]">
          <div className="p-4">
            <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">OpenAI (GPT-4o)</p>
            <pre className="text-sm font-mono whitespace-pre-wrap break-words text-[var(--text-primary)]">
              {openaiText || '(No text extracted)'}
            </pre>
          </div>
          <div className="p-4">
            <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">Google (Gemini)</p>
            <pre className="text-sm font-mono whitespace-pre-wrap break-words text-[var(--text-primary)]">
              {googleText || '(No text extracted)'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [boxedImageModal, setBoxedImageModal] = useState({ open: false, imageUrl: null, textBlocks: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (results != null) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [results]);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(f || null);
    setResults(null);
    setError(null);
    if (f) setPreviewUrl(URL.createObjectURL(f));
  };

  const removeImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setResults(null);
    setError(null);
    setPreviewModalOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyze = async () => {
    if (!file) {
      setError('Please select an image first.');
      return;
    }
    setError(null);
    setLoading(true);
    setResults(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }
      setResults(data);
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="text-center space-y-4 pt-4">
          <h1 className="text-3xl md:text-4xl font-light text-[var(--text-primary)] tracking-tight">
            Label Analyser
          </h1>
          <p className="text-[var(--text-muted)] text-sm md:text-base max-w-lg mx-auto leading-relaxed">
            Upload an image of labelled boxes. Text is extracted (QR codes ignored) via OpenAI and Google Gemini.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-center">
          <div className="flex items-center gap-2">
            {!file ? (
              <label className="flex items-center h-11 px-5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-midnight)] cursor-pointer transition-all duration-200">
                <span className="text-sm font-medium text-[var(--text-primary)]">Choose image</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <>
                <span className="flex items-center h-11 px-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-medium">
                  Choose image
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(true)}
                  className="flex-shrink-0 w-11 h-11 rounded-xl overflow-hidden border border-[var(--border-default)] hover:border-[var(--accent)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)] transition-all duration-200"
                  aria-label="Preview image"
                >
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={analyze}
            disabled={!file || loading}
            className="h-11 px-6 rounded-xl bg-[var(--accent)]/90 hover:bg-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--accent)]/90 text-sm font-medium text-[var(--bg-base)] transition-all duration-200 flex items-center justify-center"
          >
            {loading ? 'Analysing…' : 'Analyse'}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/15 text-rose-200/90 px-4 py-3 text-sm backdrop-blur-sm">
            {error}
          </div>
        )}

        <ImagePreviewModal
          open={previewModalOpen}
          imageUrl={previewUrl}
          onClose={() => setPreviewModalOpen(false)}
          onDelete={removeImage}
        />

        <GlassyModal
          open={boxedImageModal.open}
          onClose={() => setBoxedImageModal((p) => ({ ...p, open: false }))}
          bare
          className="max-w-[90vw] max-h-[90vh] flex items-center justify-center p-5"
        >
          {boxedImageModal.imageUrl &&
            ((close) => (
              <div className="relative flex items-center justify-center max-h-[85vh] max-w-full">
                <ImageWithBoxes
                  imageUrl={boxedImageModal.imageUrl}
                  textBlocks={boxedImageModal.textBlocks}
                  className="max-w-full"
                  imgClassName="max-h-[85vh] w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={close}
                  className="absolute top-3 right-3 z-10 w-9 h-9 rounded-lg bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/90 transition-colors"
                  aria-label="Close"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
            ))}
        </GlassyModal>

        {results != null && (
          <section ref={resultsRef} className="space-y-6" aria-label="Analysis results">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Results</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <ProviderResult
                name="OpenAI (GPT-4o)"
                result={results.openai ?? {}}
                imageUrl={previewUrl ?? ''}
                isError={!!results.openai?.error}
                onImageClick={(url, blocks) => setBoxedImageModal({ open: true, imageUrl: url, textBlocks: blocks ?? [] })}
              />
              <ProviderResult
                name="Google (Gemini)"
                result={results.google ?? {}}
                imageUrl={previewUrl ?? ''}
                isError={!!results.google?.error}
                onImageClick={(url, blocks) => setBoxedImageModal({ open: true, imageUrl: url, textBlocks: blocks ?? [] })}
              />
            </div>
            <ExtractedTextComparison
              openaiText={results.openai?.error ? undefined : results.openai?.fullText}
              googleText={results.google?.error ? undefined : results.google?.fullText}
            />
          </section>
        )}
      </div>
    </div>
  );
}
