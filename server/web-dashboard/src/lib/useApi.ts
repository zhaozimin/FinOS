import { useEffect, useRef, useState } from "react";

interface State<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
}

export function useApi<T>(loader: () => Promise<T>, deps: ReadonlyArray<unknown>): State<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    loaderRef.current()
      .then((value) => {
        if (!aborted) {
          setData(value);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, refresh: () => setTick((t) => t + 1) };
}
