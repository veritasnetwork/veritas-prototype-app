'use client';

import { useEffect } from 'react';
import { setupChunkErrorHandler } from '@/lib/chunk-error-handler';

export function ClientChunkErrorHandler() {
  useEffect(() => {
    setupChunkErrorHandler();
  }, []);

  return null;
}