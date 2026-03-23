import { useState, useRef, useEffect } from 'react';
import { analyzeLabel, getDefaultPrompt } from '../lib/api';
import { compressAndToBase64 } from '../lib/compress';
import { CameraCapture } from '../components/CameraCapture';
import { ImageWithBoxes, IMAGE_WITH_BOXES_IMG_FULLSCREEN } from '../components/ImageWithBoxes';
import { useAnalyzeState } from '../contexts/AnalyzeStateContext';

const MODAL_DURATION_MS = 200;

function normalizeTextBlocks(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getFirstImageFile(files) {
  if (!files?.length) return null;
  for (let i = 0; i < files.length; i++) {
    if (files[i].type?.startsWith('image/')) return files[i];
  }
  return null;
}

export function AnalyzePage() {
  const {
    singleImage,
    setSingleImage,
    loading,
    setLoading,
    error,
    setError,
    result,
    setResult,
    batchFiles,
    setBatchFiles,
    batchProgress,
    setBatchProgress,
    batchDone,
    setBatchDone,
  } = useAnalyzeState();

  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [promptModalClosing, setPromptModalClosing] = useState(false);
  const [promptModalMounted, setPromptModalMounted] = useState(false);
  const [boxedImageModal, setBoxedImageModal] = useState({ open: false, imageUrl: null, textBlocks: [] });
  const [imagesModalClosing, setImagesModalClosing] = useState(false);
  const [imagesModalMounted, setImagesModalMounted] = useState(false);
  const [batchImageModal, setBatchImageModal] = useState({ open: false, url: null });
  const [batchImageModalClosing, setBatchImageModalClosing] = useState(false);
  const [batchImageModalMounted, setBatchImageModalMounted] = useState(false);
  const singleInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    getDefaultPrompt()
      .then((p) => {
        setDefaultPrompt(p);
        setPromptText(p);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (boxedImageModal.open) {
      const t = requestAnimationFrame(() => setImagesModalMounted(true));
      return () => cancelAnimationFrame(t);
    }
    setImagesModalMounted(false);
  }, [boxedImageModal.open]);

  useEffect(() => {
    if (batchImageModal.open) {
      const t = requestAnimationFrame(() => setBatchImageModalMounted(true));
      return () => cancelAnimationFrame(t);
    }
    setBatchImageModalMounted(false);
  }, [batchImageModal.open]);

  useEffect(() => {
    if (showPromptEditor) {
      if (!promptText && defaultPrompt) setPromptText(defaultPrompt);
      if (!promptText && !defaultPrompt) {
        getDefaultPrompt()
          .then((p) => {
            setDefaultPrompt(p);
            setPromptText(p);
          })
          .catch(() => {});
      }
      const t = requestAnimationFrame(() => setPromptModalMounted(true));
      return () => cancelAnimationFrame(t);
    }
    setPromptModalMounted(false);
  }, [showPromptEditor]);

  const closePromptModal = () => {
    setPromptModalClosing(true);
    setTimeout(() => {
      setShowPromptEditor(false);
      setPromptModalClosing(false);
    }, MODAL_DURATION_MS);
  };

  const closeBoxedImageModal = () => {
    setImagesModalClosing(true);
    setTimeout(() => {
      setBoxedImageModal({ open: false, imageUrl: null, textBlocks: [] });
      setImagesModalClosing(false);
    }, MODAL_DURATION_MS);
  };

  const canAnalyze = singleImage && !loading;
  const canBatchAnalyze = batchFiles.length > 0 && !loading && !batchProgress;
  const canRunAnyAnalyse = canAnalyze || canBatchAnalyze;
  const isAnalysing = loading || batchProgress;
  const analyseButtonLabel = batchProgress
    ? `Analysing ${batchProgress.current}/${batchProgress.total}…`
    : loading
      ? 'Analysing…'
      : batchFiles.length > 0
        ? `Analyse all (${batchFiles.length})`
        : 'Analyse';

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = getFirstImageFile(e.dataTransfer.files);
    if (file) {
      if (singleImage?.url) URL.revokeObjectURL(singleImage.url);
      setSingleImage({ file, url: URL.createObjectURL(file) });
    }
    setError(null);
    setResult(null);
  };

  const handleSingleFile = (file) => {
    if (!file?.type.startsWith('image/')) return;
    if (singleImage?.url) URL.revokeObjectURL(singleImage.url);
    setSingleImage({ file, url: URL.createObjectURL(file) });
    setError(null);
    setResult(null);
  };

  const handleSingleUpload = (e) => {
    const file = e?.target?.files?.[0];
    if (file) handleSingleFile(file);
    if (e?.target) e.target.value = '';
  };

  const clearSingle = () => {
    if (singleImage?.url) URL.revokeObjectURL(singleImage.url);
    setSingleImage(null);
    setError(null);
    setResult(null);
    if (singleInputRef.current) singleInputRef.current.value = '';
  };

  const onCameraCapture = (blob) => {
    handleSingleFile(new File([blob], 'capture.jpg', { type: 'image/jpeg' }));
    setCameraOpen(false);
  };

  const handleBatchChange = (e) => {
    const list = e.target.files;
    if (!list?.length) return;
    const files = Array.from(list).filter((f) => f.type?.startsWith('image/'));
    const sortKey = (f) => f.webkitRelativePath || f.name || '';
    files.sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true }));
    setBatchFiles((prev) => {
      prev.forEach((entry) => entry?.url && URL.revokeObjectURL(entry.url));
      return files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    });
    setBatchDone(null);
    setError(null);
    e.target.value = '';
  };

  const removeBatchFile = (index) => {
    setBatchFiles((prev) => {
      const entry = prev[index];
      if (entry?.url) URL.revokeObjectURL(entry.url);
      return prev.filter((_, i) => i !== index);
    });
    setBatchDone(null);
  };

  const openBatchImageModal = (url) => setBatchImageModal({ open: true, url });
  const closeBatchImageModal = () => {
    setBatchImageModalClosing(true);
    setTimeout(() => {
      setBatchImageModal({ open: false, url: null });
      setBatchImageModalClosing(false);
    }, MODAL_DURATION_MS);
  };

  const runAnalysis = async () => {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const base64 = await compressAndToBase64(singleImage.file);
      const data = await analyzeLabel(base64, promptText, singleImage.file.name);
      setResult(data);
      if (singleImage?.url) URL.revokeObjectURL(singleImage.url);
      setSingleImage(null);
      if (singleInputRef.current) singleInputRef.current.value = '';
    } catch (err) {
      setError(err.message || 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const runBatchAnalysis = async () => {
    if (!canBatchAnalyze) return;
    setLoading(true);
    setError(null);
    setBatchDone(null);
    const total = batchFiles.length;
    let done = 0;
    let failed = 0;
    for (let i = 0; i < total; i++) {
      setBatchProgress({ current: i + 1, total });
      try {
        const file = batchFiles[i].file;
        const base64 = await compressAndToBase64(file);
        await analyzeLabel(base64, promptText, file.name);
        done += 1;
      } catch {
        failed += 1;
      }
    }
    setBatchProgress(null);
    setBatchDone({ done, failed, total });
    setBatchFiles((prev) => {
      prev.forEach((entry) => entry?.url && URL.revokeObjectURL(entry.url));
      return [];
    });
    setLoading(false);
    if (batchInputRef.current) batchInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  return (
    <div className="w-full max-w-3xl mx-auto min-w-0">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-text mb-2">
          Analyse labels
        </h1>
        <p className="text-muted text-sm leading-relaxed">
          Upload or capture label images. We extract text (QR codes ignored) using Google Gemini.
          <br />
          Single image or multiple at once.
        </p>
      </header>

      <section className="card p-4 sm:p-6 mb-6">
        <div className="mb-3">
          <span className="text-sm tracking-wide uppercase text-muted">Single Image</span>
        </div>
        <div
          className={`relative aspect-[4/3] rounded-xl overflow-hidden flex items-center justify-center transition-all duration-200 mb-4 ${
            dragOver ? 'ring-2 ring-accent/50 bg-accent/10 border-2 border-accent/40' : 'bg-bg border border-dashed border-[var(--color-border-subtle)]'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {singleImage ? (
            <>
              <img src={singleImage.url} alt="Label" className="w-full h-full object-contain" />
              {(loading || result) && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-bg/80 pointer-events-none"
                  aria-hidden
                >
                  {loading ? (
                    <span className="w-12 h-12 rounded-full border-2 border-[var(--color-border-subtle)] border-t-accent animate-spin" />
                  ) : result ? (
                    <span className="flex items-center justify-center" aria-hidden>
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  ) : null}
                </div>
              )}
              {!loading && (
                <button
                  type="button"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-bg/90 text-text hover:text-error flex items-center justify-center transition-colors backdrop-blur-sm border border-[var(--color-border-subtle)]"
                  onClick={clearSingle}
                  aria-label="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </>
          ) : (
            <span className="text-muted/90 text-sm flex flex-col items-center justify-center gap-2 text-center px-4">
              {dragOver ? (
                <span className="font-medium text-accent">Drop here</span>
              ) : (
                <>
                  <span className="font-semibold text-text/80">No image</span>
                  <span className="text-xs">Drag & drop or use buttons below</span>
                </>
              )}
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <input
            ref={singleInputRef}
            type="file"
            accept="image/*"
            onChange={handleSingleUpload}
            className="hidden"
          />
          <button
            type="button"
            className="flex-1 h-8 px-3 py-1.5 rounded-lg text-xs font-medium text-text bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:border-muted/30 transition-colors"
            onClick={() => singleInputRef.current?.click()}
          >
            Upload
          </button>
          <button
            type="button"
            className="flex-1 h-8 px-3 py-1.5 rounded-lg text-xs font-medium text-text bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:border-muted/30 transition-colors"
            onClick={() => {
              if (!navigator.mediaDevices?.getUserMedia) {
                setError('Camera not supported in this browser.');
                return;
              }
              setCameraOpen(true);
              setError(null);
            }}
          >
            Capture
          </button>
        </div>

        <div className="pt-6 border-t border-[var(--color-border-subtle)]">
          <span className="text-sm tracking-wide uppercase text-muted block mb-3">Multiple Images</span>
          <p className="text-muted text-sm mb-3 leading-relaxed">
            Folder or multiple images (sorted by filename). Each image is analysed and saved to history.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={folderInputRef}
              type="file"
              accept="image/*"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleBatchChange}
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
            />
            <input
              ref={batchInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleBatchChange}
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
            />
            <button
              type="button"
              className="h-8 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:border-muted/30 transition-colors"
              onClick={() => folderInputRef.current?.click()}
            >
              Choose folder
            </button>
            <button
              type="button"
              className="h-8 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:border-muted/30 transition-colors"
              onClick={() => batchInputRef.current?.click()}
            >
              Choose images
            </button>
          </div>
          {batchFiles.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {batchFiles.map((entry, i) => {
                const isDone = batchDone || (batchProgress && batchProgress.current > i + 1);
                const showOverlay = batchProgress || batchDone;
                return (
                  <div
                    key={i}
                    className="relative group rounded-xl overflow-hidden border border-[var(--color-border-subtle)] bg-bg aspect-square"
                  >
                    <button
                      type="button"
                      className="block w-full h-full focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-inset rounded-xl"
                      onClick={() => openBatchImageModal(entry.url)}
                    >
                      <img
                        src={entry.url}
                        alt={entry.file.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    {showOverlay && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-bg/80 pointer-events-none"
                        aria-hidden
                      >
                        {isDone ? (
                          <span className="flex items-center justify-center" aria-hidden>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </span>
                        ) : (
                          <span className="w-10 h-10 rounded-full border-2 border-[var(--color-border-subtle)] border-t-accent animate-spin" />
                        )}
                      </div>
                    )}
                    {!isAnalysing && (
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-bg/90 text-muted hover:text-error flex items-center justify-center transition-colors border border-[var(--color-border-subtle)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBatchFile(i);
                        }}
                        aria-label={`Remove ${entry.file.name}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <span className="absolute bottom-0 left-0 right-0 py-1 px-2 bg-bg/90 text-[0.65rem] text-muted truncate block" title={entry.file.name}>
                      {entry.file.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {batchDone && (
            <p className="text-success text-sm mt-3 m-0">
              {batchDone.done} saved to history.
              {batchDone.failed > 0 && ` ${batchDone.failed} failed.`}
            </p>
          )}
        </div>
      </section>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      <section className="mb-6">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <button
            type="button"
            className="h-8 px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 text-accent font-medium text-xs hover:bg-accent/20 hover:border-accent/60 transition-colors"
            onClick={() => setShowPromptEditor(true)}
          >
            Edit extraction prompt
          </button>
          <button
            type="button"
            className="h-8 px-3 py-1.5 rounded-lg bg-accent text-bg font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-accent-dim transition-colors shadow-lg shadow-accent/20"
            disabled={!canRunAnyAnalyse || isAnalysing}
            onClick={() => {
              if (isAnalysing) return;
              if (batchFiles.length > 0) runBatchAnalysis();
              else runAnalysis();
            }}
          >
            {analyseButtonLabel}
          </button>
          {!canRunAnyAnalyse && (
            <span className="text-muted text-sm">Add image(s) above, then run analysis.</span>
          )}
        </div>
      </section>

      {(showPromptEditor || promptModalClosing) && (
        <div
          className={`fixed inset-0 overlay z-50 flex items-center justify-center p-3 sm:p-4 transition-all duration-200 ease-out ${
            promptModalMounted && !promptModalClosing ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'
          } ${promptModalClosing ? 'pointer-events-none' : ''}`}
          onClick={closePromptModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-modal-title"
        >
          <div
            className={`w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-5 rounded-2xl border border-[var(--color-border-subtle)] bg-surface shadow-2xl transition-all duration-200 ease-out ${
              promptModalMounted && !promptModalClosing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="prompt-modal-title" className="text-lg font-semibold text-text mb-2">
              Edit extraction prompt
            </h2>
            <p className="text-muted text-sm mb-3 leading-relaxed">
              This prompt is sent with the image. The model should return JSON with textBlocks and fullText.
            </p>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border-subtle)] bg-bg text-text text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted"
              placeholder="Extraction prompt..."
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                className="h-8 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-muted hover:text-text transition-colors"
                onClick={() => setPromptText(defaultPrompt)}
              >
                Reset to default
              </button>
              <button
                type="button"
                className="h-8 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-muted hover:text-text transition-colors"
                onClick={closePromptModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {cameraOpen && (
        <CameraCapture onCapture={onCameraCapture} onClose={() => setCameraOpen(false)} />
      )}

      {result && (
        <section className="card p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-text mb-4">Results</h2>
          {(result.obbDetectionCount != null || result.obbFallback === true) && (
            <p className="text-sm text-muted mb-3" role="status">
              {result.obbFallback
                ? 'No label regions detected; text was extracted using full-image Gemini (fallback).'
                : `${result.obbDetectionCount} detection${result.obbDetectionCount === 1 ? '' : 's'} (YOLO OBB + Gemini per crop).`}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted/90 uppercase tracking-wider font-medium mb-2">Extracted text</p>
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-bg p-3 h-60 overflow-auto">
                <pre className="text-sm font-mono whitespace-pre-wrap break-words text-text m-0">
                  {result.fullText?.trim() || '—'}
                </pre>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted/90 uppercase tracking-wider font-medium mb-2">Image with bounding boxes</p>
              {(result.imageUrl || singleImage?.url) ? (
                <>
                  <div
                    className="rounded-xl overflow-hidden border border-[var(--color-border-subtle)] h-60 w-full bg-[var(--color-surface-elevated)] flex flex-col p-1 min-h-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex-1 min-h-0 w-full min-w-0 relative">
                      <ImageWithBoxes
                        fillContainer
                        imageUrl={result.imageUrl || singleImage?.url}
                        textBlocks={normalizeTextBlocks(result.textBlocks)}
                        className="h-full w-full"
                        imgClassName=""
                        buttonClassName="h-full w-full min-h-0 min-w-0 !p-0 bg-transparent"
                        onClick={(url, blocks) => setBoxedImageModal({ open: true, imageUrl: url, textBlocks: blocks })}
                      />
                    </div>
                  </div>
                  <p className="text-muted text-[0.7rem] mt-1">Click image to view full size</p>
                </>
              ) : (
                <p className="text-muted text-sm py-4">No image available.</p>
              )}
            </div>
          </div>
          <p className="mt-6 pt-4 border-t border-[var(--color-border-subtle)] text-success text-sm">
            Saved to history. View it on the History page.
          </p>
        </section>
      )}

      {boxedImageModal.open && (
        <div
          className={`fixed inset-0 overlay z-50 flex items-center justify-center p-3 sm:p-4 transition-all duration-200 ease-out ${
            imagesModalMounted && !imagesModalClosing ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'
          } ${imagesModalClosing ? 'pointer-events-none' : ''}`}
          onClick={closeBoxedImageModal}
          role="dialog"
          aria-modal="true"
          aria-label="Image with bounding boxes"
        >
          <div
            className={`flex flex-col max-w-4xl w-full max-h-[calc(100dvh-1.5rem)] overflow-auto transition-all duration-200 ease-out ${
              imagesModalMounted && !imagesModalClosing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative rounded-xl border border-[var(--color-border-subtle)] bg-surface overflow-hidden">
              {boxedImageModal.imageUrl ? (
                <ImageWithBoxes
                  imageUrl={boxedImageModal.imageUrl}
                  textBlocks={normalizeTextBlocks(boxedImageModal.textBlocks)}
                  className="max-w-full"
                  imgClassName={IMAGE_WITH_BOXES_IMG_FULLSCREEN}
                />
              ) : (
                <p className="text-muted text-sm p-6">No image.</p>
              )}
              <button
                type="button"
                className="absolute top-2 right-2 z-10 w-8 h-8 rounded-lg overlay-btn flex items-center justify-center border border-[var(--color-border-subtle)] hover:!text-error transition-colors"
                onClick={closeBoxedImageModal}
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {batchImageModal.open && (
        <div
          className={`fixed inset-0 overlay z-50 flex items-center justify-center p-3 sm:p-4 transition-all duration-200 ease-out ${
            batchImageModalMounted && !batchImageModalClosing ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'
          } ${batchImageModalClosing ? 'pointer-events-none' : ''}`}
          onClick={closeBatchImageModal}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div
            className={`flex flex-col max-w-4xl w-full max-h-[calc(100dvh-1.5rem)] overflow-auto transition-all duration-200 ease-out ${
              batchImageModalMounted && !batchImageModalClosing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative rounded-xl border border-[var(--color-border-subtle)] bg-surface overflow-hidden">
              {batchImageModal.url ? (
                <img
                  src={batchImageModal.url}
                  alt="Preview"
                  className="max-w-full max-h-[85dvh] w-auto h-auto object-contain"
                />
              ) : (
                <p className="text-muted text-sm p-6">No image.</p>
              )}
              <button
                type="button"
                className="absolute top-2 right-2 z-10 w-8 h-8 rounded-lg overlay-btn flex items-center justify-center border border-[var(--color-border-subtle)] hover:!text-error transition-colors"
                onClick={closeBatchImageModal}
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
