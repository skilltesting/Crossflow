import { useCallback, useEffect, useRef, useState } from 'react';
import { randomMockNotification } from '../lib/mockData';
import type { MockNotification } from '../types';

interface Options {
  intervalMs?: number;
  onNotification: (n: MockNotification) => void;
}

export function useMockNotifications({ intervalMs = 9000, onNotification }: Options) {
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const callbackRef = useRef(onNotification);

  useEffect(() => {
    callbackRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      callbackRef.current(randomMockNotification());
    }, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [running, intervalMs]);

  const start = useCallback(() => setRunning(true), []);
  const stop = useCallback(() => setRunning(false), []);
  const toggle = useCallback(() => setRunning((r) => !r), []);
  const fireOnce = useCallback(() => callbackRef.current(randomMockNotification()), []);

  return { running, start, stop, toggle, fireOnce };
}
