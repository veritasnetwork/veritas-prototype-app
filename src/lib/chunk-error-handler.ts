'use client';

// Track chunk loading retries
const chunkRetries = new Map<string, number>();
const MAX_RETRIES = 3;

// Handle chunk loading errors with automatic retry
export function setupChunkErrorHandler() {
  if (typeof window === 'undefined') return;

  // Listen for unhandled promise rejections (chunk loading errors)
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;

    // Check if this is a chunk loading error
    if (
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Failed to import')
    ) {
      event.preventDefault(); // Prevent error from showing in console

      // Extract chunk identifier from error message
      const chunkMatch = error.message.match(/chunk[s]?\s+(\d+)/i);
      const chunkId = chunkMatch ? chunkMatch[1] : 'unknown';

      // Track retry count
      const retryCount = chunkRetries.get(chunkId) || 0;

      if (retryCount < MAX_RETRIES) {
        console.warn(`Chunk ${chunkId} failed to load, retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        chunkRetries.set(chunkId, retryCount + 1);

        // Delay before reload to avoid rapid retries
        setTimeout(() => {
          // Try to reload the page with cache bypass
          window.location.reload();
        }, 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        console.error(`Failed to load chunk ${chunkId} after ${MAX_RETRIES} retries`);

        // Show user-friendly error message
        showChunkErrorMessage();
      }
    }
  });

  // Also handle script loading errors
  if (typeof window !== 'undefined') {
    const originalScriptError = window.onerror;

    window.onerror = function(msg, url, lineNo, columnNo, error) {
      // Check if this is a script loading error
      if (
        typeof msg === 'string' &&
        (msg.includes('Loading chunk') || msg.includes('Failed to fetch'))
      ) {
        console.warn('Script loading error detected, attempting recovery...');

        // Clear module cache if possible
        if ('webpackChunkName' in window) {
          try {
            // Force webpack to retry loading
            delete (window as any).webpackChunkName;
          } catch (e) {
            console.warn('Could not clear webpack cache:', e);
          }
        }

        // Retry loading after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);

        return true; // Prevent default error handling
      }

      // Call original error handler
      if (originalScriptError) {
        return originalScriptError(msg, url, lineNo, columnNo, error);
      }

      return false;
    };
  }
}

// Show user-friendly error message
function showChunkErrorMessage() {
  // Check if error dialog already exists
  if (document.getElementById('chunk-error-dialog')) return;

  const dialog = document.createElement('div');
  dialog.id = 'chunk-error-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #1a1a1a;
    border: 1px solid #B9D9EB;
    border-radius: 8px;
    padding: 24px;
    z-index: 99999;
    max-width: 400px;
    text-align: center;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  dialog.innerHTML = `
    <h3 style="color: #F0EAD6; margin: 0 0 12px 0; font-size: 18px;">
      Loading Error
    </h3>
    <p style="color: #B9D9EB; margin: 0 0 20px 0; font-size: 14px; line-height: 1.5;">
      We're having trouble loading some resources. This can happen due to network issues or browser cache problems.
    </p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button onclick="window.location.reload(true)" style="
        background: #B9D9EB;
        color: #0C1D51;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      ">
        Reload Page
      </button>
      <button onclick="
        if (navigator.serviceWorker) {
          navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
              registration.unregister();
            }
          });
        }
        caches.keys().then(function(names) {
          for (let name of names) caches.delete(name);
        }).then(() => window.location.reload(true));
      " style="
        background: transparent;
        color: #B9D9EB;
        border: 1px solid #B9D9EB;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      ">
        Clear Cache & Reload
      </button>
    </div>
  `;

  document.body.appendChild(dialog);
}

// Initialize on client side
if (typeof window !== 'undefined') {
  setupChunkErrorHandler();
}