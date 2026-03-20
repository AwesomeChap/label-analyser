import { createContext, useContext, useState } from 'react';

const AnalyzeStateContext = createContext(null);

export function useAnalyzeState() {
  const ctx = useContext(AnalyzeStateContext);
  if (!ctx) throw new Error('useAnalyzeState must be used within AnalyzeStateProvider');
  return ctx;
}

export function AnalyzeStateProvider({ children }) {
  const [singleImage, setSingleImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchProgress, setBatchProgress] = useState(null);
  const [batchDone, setBatchDone] = useState(null);

  const value = {
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
  };

  return (
    <AnalyzeStateContext.Provider value={value}>
      {children}
    </AnalyzeStateContext.Provider>
  );
}
