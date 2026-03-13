import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnalyzePage } from './pages/AnalyzePage';
import { HistoryPage } from './pages/HistoryPage';
import { useTheme } from './hooks/useTheme';
import { AnalyzeStateProvider } from './contexts/AnalyzeStateContext';

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="min-h-[44px] min-w-[44px] h-10 w-10 rounded-md flex items-center justify-center text-muted hover:text-text transition-colors shrink-0"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function App() {
  const location = useLocation();
  const isAnalyze = location.pathname === '/';
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-bg transition-colors duration-200">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-[var(--color-border-subtle)] bg-bg/80 backdrop-blur-xl pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <Link to="/" className="flex items-center gap-2.5 text-base sm:text-xl font-semibold tracking-tight text-text hover:no-underline shrink-0 min-w-0">
          <span className="w-1 sm:w-1.5 h-4 sm:h-5 bg-accent shrink-0" aria-hidden />
          <span className="truncate">Label Analyser</span>
        </Link>
        <nav className="flex items-center gap-1 rounded-lg p-1 bg-bg shrink-0">
          <Link
            to="/"
            className={`rounded-md px-3 py-2.5 text-sm font-medium min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-colors ${isAnalyze ? 'text-accent' : 'text-muted hover:text-text'}`}
          >
            Analyse
          </Link>
          <Link
            to="/history"
            className={`rounded-md px-3 py-2.5 text-sm font-medium min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-colors ${!isAnalyze ? 'text-accent' : 'text-muted hover:text-text'}`}
          >
            History
          </Link>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </nav>
      </header>
      <main className="flex-1 w-full max-w-[900px] mx-auto min-w-0 px-4 py-6 sm:px-6 sm:py-8 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <AnalyzeStateProvider>
          <Routes>
            <Route path="/" element={<AnalyzePage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </AnalyzeStateProvider>
      </main>
    </div>
  );
}

export default App;
