import { useState, useEffect, useRef } from 'react';
import { getHistory, deleteLabel, deleteAllLabels, reanalyseLabel } from '../lib/api';
import { ImageWithBoxes } from '../components/ImageWithBoxes';

const IMAGES_MODAL_DURATION_MS = 200;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];
const PAGE_SIZE_STORAGE_KEY = 'labelAnalyser_history_pageSize';

function getStoredPageSize() {
  try {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const n = stored != null ? parseInt(stored, 10) : NaN;
    return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

/** Ensure textBlocks is always an array (API/Supabase may return string or null). */
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

export function HistoryPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [boxedImageModal, setBoxedImageModal] = useState({ open: false, imageUrl: null, textBlocks: [] });
  const [imagesModalClosing, setImagesModalClosing] = useState(false);
  const [imagesModalMounted, setImagesModalMounted] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [reAnalyzingId, setReAnalyzingId] = useState(null);
  const [editingPromptId, setEditingPromptId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getStoredPageSize);
  /** Cache: { [pageSize]: { _total?, [pageNum]: items[] } }. Invalidated on delete. */
  const pageCacheRef = useRef({});

  useEffect(() => {
    const item = items.find((i) => i.id === expandedId);
    setEditedPrompt(item?.extractionPrompt ?? '');
  }, [expandedId, items]);

  useEffect(() => {
    if (expandedId !== editingPromptId) setEditingPromptId(null);
  }, [expandedId]);

  const loadHistory = (pageNum, options = {}) => {
    const { invalidateCache = false } = options;
    if (invalidateCache) pageCacheRef.current = {};

    const sizeCache = pageCacheRef.current[pageSize] || {};
    const cachedItems = sizeCache[pageNum];
    const cachedTotal = sizeCache._total;
    if (!invalidateCache && cachedItems !== undefined && typeof cachedTotal === 'number') {
      setItems(cachedItems);
      setTotal(cachedTotal);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    getHistory(pageNum, pageSize)
      .then((res) => {
        const list = res.items ?? [];
        const totalCount = typeof res.total === 'number' ? res.total : list.length;
        if (list.length === 0 && pageNum > 1) {
          setPage(1);
          return;
        }
        const nextSizeCache = pageCacheRef.current[pageSize] || {};
        nextSizeCache[pageNum] = list;
        nextSizeCache._total = totalCount;
        pageCacheRef.current[pageSize] = nextSizeCache;
        setItems(list);
        setTotal(totalCount);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHistory(page);
  }, [page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showEnd = total > 0 ? start + items.length - 1 : 0;

  useEffect(() => {
    if (boxedImageModal.open) {
      const t = requestAnimationFrame(() => setImagesModalMounted(true));
      return () => cancelAnimationFrame(t);
    }
    setImagesModalMounted(false);
  }, [boxedImageModal.open]);

  const closeBoxedImageModal = () => {
    setImagesModalClosing(true);
    setTimeout(() => {
      setBoxedImageModal({ open: false, imageUrl: null, textBlocks: [] });
      setImagesModalClosing(false);
    }, IMAGES_MODAL_DURATION_MS);
  };

  const handleReAnalyze = async (e, item) => {
    e.stopPropagation();
    const prompt = typeof editedPrompt === 'string' ? editedPrompt.trim() : '';
    setReAnalyzingId(item.id);
    setError(null);
    try {
      await reanalyseLabel(item.id, prompt || undefined);
      loadHistory(page);
    } catch (err) {
      setError(err.message || 'Re-analysis failed.');
    } finally {
      setReAnalyzingId(null);
    }
  };

  const handleDeleteOne = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this analysis from history?')) return;
    setDeletingId(id);
    try {
      await deleteLabel(id);
      if (expandedId === id) setExpandedId(null);
      loadHistory(page, { invalidateCache: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all analyses from history? This cannot be undone.')) return;
    setDeletingId('all');
    try {
      await deleteAllLabels();
      pageCacheRef.current = {};
      setItems([]);
      setTotal(0);
      setPage(1);
      setExpandedId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-text mb-2">
            History
          </h1>
          <p className="text-muted text-sm leading-relaxed">
            Past analyses. Click a row to expand and see extracted text and image with boxes.
          </p>
        </header>
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-text mb-2">
            History
          </h1>
        </header>
        <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto min-w-0">
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-text mb-2">
              History
            </h1>
            <p className="text-muted text-sm leading-relaxed">
              Past analyses. Click a row to expand and see extracted text and image with boxes.
            </p>
          </div>
          {total > 0 && (
            <button
              type="button"
              className="h-8 px-3 py-1.5 rounded-lg text-xs font-medium text-muted bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:text-error transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
              onClick={handleDeleteAll}
              disabled={!!deletingId}
            >
              {deletingId === 'all' ? 'Deleting…' : 'Delete all'}
            </button>
          )}
        </div>
      </header>

      {total === 0 ? (
        <div className="card p-6 sm:p-8 text-center">
          <p className="text-muted text-sm m-0">No analyses yet.</p>
          <p className="text-muted text-xs mt-1 m-0">Analyse labels on the Analyse page to see them here.</p>
        </div>
      ) : (
        <>
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const displayName = item.name?.trim() || 'Unnamed';
            return (
              <li
                key={item.id}
                className={`card overflow-hidden cursor-pointer transition-all duration-200 min-h-0 ${
                  isExpanded
                    ? 'ring-1 ring-accent/30 border-accent/30'
                    : 'hover:border-muted/20'
                }`}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedId(isExpanded ? null : item.id);
                  }
                }}
                aria-expanded={isExpanded}
              >
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 text-xs min-w-0">
                  <span className="font-semibold text-text flex-1 min-w-0 truncate">{displayName}</span>
                  <button
                    type="button"
                    className="w-8 h-8 min-w-[2rem] min-h-[2rem] rounded-md border-0 bg-transparent text-muted hover:text-error flex items-center justify-center shrink-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={(e) => handleDeleteOne(e, item.id)}
                    disabled={!!deletingId || reAnalyzingId === item.id}
                    title="Delete"
                    aria-label="Delete this analysis"
                  >
                    {deletingId === item.id ? (
                      <span className="text-xs">…</span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`text-muted/70 text-[0.55rem] shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden
                  >
                    ▼
                  </span>
                </div>
                {isExpanded && (
                  <div
                    className="min-w-0 px-4 py-4 sm:px-5 border-t border-[var(--color-border-subtle)] flex flex-col gap-4 relative cursor-default"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {reAnalyzingId === item.id ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-live="polite" aria-busy="true">
                          <div>
                            <p className="text-xs text-muted/90 uppercase tracking-wider font-medium mb-2">Extracted text</p>
                            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-bg p-3 h-60 overflow-hidden">
                              <div className="h-4 rounded bg-[var(--color-surface-elevated)] animate-pulse mb-2 w-full" aria-hidden />
                              <div className="h-4 rounded bg-[var(--color-surface-elevated)] animate-pulse mb-2 w-full" aria-hidden />
                              <div className="h-4 rounded bg-[var(--color-surface-elevated)] animate-pulse mb-2 w-4/5" aria-hidden />
                              <div className="h-4 rounded bg-[var(--color-surface-elevated)] animate-pulse w-3/5" aria-hidden />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted/90 uppercase tracking-wider font-medium mb-2">Image with bounding boxes</p>
                            <div className="rounded-xl overflow-hidden border border-[var(--color-border-subtle)] h-60 bg-[var(--color-surface-elevated)] animate-pulse" aria-hidden />
                            <p className="text-muted text-[0.7rem] mt-1">Click image to view full size</p>
                          </div>
                        </div>

                        <div className="-mt-2">
                        {editingPromptId === item.id ? (
                          <div className="grid grid-cols-1 gap-1 sm:gap-3 items-start text-sm min-w-0">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted/90 text-xs font-medium uppercase tracking-wider">
                                Extraction prompt
                              </span>
                              <button
                                type="button"
                                className="p-1 rounded text-muted hover:text-text hover:bg-[var(--color-surface-elevated)] transition-colors shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPromptId(null);
                                  setEditedPrompt(item.extractionPrompt ?? '');
                                }}
                                aria-label="Close edit"
                                title="Close"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                            <textarea
                              value={editedPrompt}
                              onChange={(e) => setEditedPrompt(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              rows={4}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-bg text-text text-[0.85rem] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted"
                              placeholder="Extraction prompt used for this analysis..."
                              spellCheck={false}
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-1 sm:gap-3 items-start text-sm min-w-0">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted/90 text-xs font-medium uppercase tracking-wider">
                                Extraction prompt
                              </span>
                              <button
                                type="button"
                                className="p-1 rounded text-muted hover:text-accent hover:bg-[var(--color-surface-elevated)] transition-colors shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPromptId(item.id);
                                  setEditedPrompt(item.extractionPrompt ?? '');
                                }}
                                aria-label="Edit extraction prompt"
                                title="Edit prompt"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            </div>
                            <span className="text-text break-words whitespace-pre-wrap text-[0.85rem] leading-relaxed">
                              {editedPrompt?.trim() || '—'}
                            </span>
                          </div>
                        )}
                        </div>
                        <button
                          type="button"
                          className="self-start px-3 py-1.5 rounded-xl text-xs font-medium bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 hover:border-accent/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1"
                          disabled
                        >
                          Re-analysing…
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted/90 uppercase tracking-wider font-medium mb-2">Extracted text</p>
                            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-bg p-3 h-60 overflow-auto">
                              <pre className="text-sm font-mono whitespace-pre-wrap break-words text-text m-0">
                                {item.fullText?.trim() || '(No text extracted)'}
                              </pre>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted/90 uppercase tracking-wider font-medium mb-2">Image with bounding boxes</p>
                            {item.imageUrl ? (
                              <>
                                <div
                                  className="rounded-xl overflow-hidden border border-[var(--color-border-subtle)] h-60 w-full"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ImageWithBoxes
                                    imageUrl={item.imageUrl}
                                    textBlocks={normalizeTextBlocks(item.textBlocks)}
                                    className="block w-full h-full"
                                    imgClassName="w-full h-full object-cover"
                                    buttonClassName="h-full"
                                    onClick={(url, blocks) => setBoxedImageModal({ open: true, imageUrl: url, textBlocks: blocks })}
                                  />
                                </div>
                                <p className="text-muted text-[0.7rem] mt-1">Click image to view full size</p>
                              </>
                            ) : (
                              <p className="text-muted text-sm py-4">No image available.</p>
                            )}
                          </div>
                        </div>

                        <div className="-mt-2">
                        {editingPromptId === item.id ? (
                          <div className="grid grid-cols-1 gap-1 sm:gap-3 items-start text-sm min-w-0">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted/90 text-xs font-medium uppercase tracking-wider">
                                Extraction prompt
                              </span>
                              <button
                                type="button"
                                className="p-1 rounded text-muted hover:text-text hover:bg-[var(--color-surface-elevated)] transition-colors shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPromptId(null);
                                  setEditedPrompt(item.extractionPrompt ?? '');
                                }}
                                aria-label="Close edit"
                                title="Close"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                            <textarea
                              value={editedPrompt}
                              onChange={(e) => setEditedPrompt(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              rows={4}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-bg text-text text-[0.85rem] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted"
                              placeholder="Extraction prompt used for this analysis..."
                              spellCheck={false}
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-1 sm:gap-3 items-start text-sm min-w-0">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted/90 text-xs font-medium uppercase tracking-wider">
                                Extraction prompt
                              </span>
                              <button
                                type="button"
                                className="p-1 rounded text-muted hover:text-accent hover:bg-[var(--color-surface-elevated)] transition-colors shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPromptId(item.id);
                                  setEditedPrompt(item.extractionPrompt ?? '');
                                }}
                                aria-label="Edit extraction prompt"
                                title="Edit prompt"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            </div>
                            <span className="text-text break-words whitespace-pre-wrap text-[0.85rem] leading-relaxed">
                              {item.extractionPrompt?.trim() || '—'}
                            </span>
                          </div>
                        )}
                        </div>
                        <button
                          type="button"
                          className="self-start px-3 py-1.5 rounded-xl text-xs font-medium bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 hover:border-accent/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1"
                          disabled={reAnalyzingId === item.id}
                          onClick={(e) => handleReAnalyze(e, item)}
                        >
                          {reAnalyzingId === item.id ? 'Re-analysing…' : 'Re-analyse'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {total > 0 && (
          <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-4" aria-label="Pagination">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-muted text-xs m-0">
                Showing {start}–{showEnd} of {total}
              </p>
              <span className="h-4 w-px bg-[var(--color-border-subtle)] self-center" aria-hidden />
              <label className="flex items-center gap-1.5 text-muted text-xs">
                <span>Per page</span>
                <span className="relative inline-block">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (PAGE_SIZE_OPTIONS.includes(val)) {
                        setPageSize(val);
                        setPage(1);
                        try {
                          localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(val));
                        } catch {}
                      }
                    }}
                    className="h-8 min-w-[3.25rem] pl-2 pr-7 py-1 rounded-lg text-xs font-medium bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-text hover:border-muted/30 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 cursor-pointer appearance-none"
                    aria-label="Entries per page"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" aria-hidden>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </span>
              </label>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="h-8 px-2.5 py-1 rounded-lg text-xs font-medium text-muted bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:text-text hover:border-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="text-xs text-muted px-1.5" aria-live="polite">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="h-8 px-2.5 py-1 rounded-lg text-xs font-medium text-muted bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:text-text hover:border-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </nav>
        )}
        </>
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
              imgClassName="max-h-[85dvh] w-auto object-contain"
            />
              ) : (
                <p className="text-muted text-sm p-6">No image.</p>
              )}
              <button
                type="button"
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-lg overlay-btn flex items-center justify-center border border-[var(--color-border-subtle)] hover:!text-error transition-colors"
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
    </div>
  );
}
