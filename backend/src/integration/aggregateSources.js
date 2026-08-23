import { SourceNotFoundError, SourceHttpError, SourceInvalidResponseError } from './errors.js';

// Turns any thrown error into a clean, safe status string — never a raw
// stack trace or internal detail leaked to the frontend.
function classifyError(err) {
  if (err?.name === 'AbortError') return 'timeout';
  if (err instanceof SourceHttpError) return `HTTP ${err.status}`;
  if (err instanceof SourceInvalidResponseError) return 'invalid response';
  return 'service unavailable';
}

// The generic resilience core: runs an arbitrary set of named source calls
// concurrently via Promise.allSettled, and turns whatever happens — success,
// "not found in this source", timeout, HTTP error, malformed data — into one
// consistent per-source shape. Works identically for two sources or twenty;
// nothing here knows the name "Benefits Register" or "Resident Index".
//
// sourceCalls: { [name]: () => Promise<data> }
async function aggregateSources(sourceCalls) {
  const entries = Object.entries(sourceCalls);

  const settled = await Promise.allSettled(
    entries.map(async ([name, call]) => {
      const start = Date.now();
      try {
        const data = await call();
        return { name, status: 'ok', data, responseTimeMs: Date.now() - start, error: null };
      } catch (err) {
        const responseTimeMs = Date.now() - start;
        if (err instanceof SourceNotFoundError) {
          // Genuinely absent from this source — not a failure. F8 state 2.
          return { name, status: 'ok', data: null, responseTimeMs, error: null };
        }
        return { name, status: 'unavailable', data: null, responseTimeMs, error: classifyError(err) };
      }
    })
  );

  const sources = {};
  for (const result of settled) {
    // Every branch above resolves rather than rejects, so this is always
    // 'fulfilled' — Promise.allSettled is used anyway per the project's
    // engineering rule, as defense in depth against a future code change
    // that forgets to catch.
    const r = result.value;
    sources[r.name] = {
      status: r.status,
      data: r.data,
      responseTimeMs: r.responseTimeMs,
      cached: false,
      ...(r.error ? { error: r.error } : {}),
    };
  }

  const total = entries.length;
  const okCount = Object.values(sources).filter((s) => s.status === 'ok').length;
  const overallStatus = total === 0 ? 'unavailable' : okCount === total ? 'complete' : okCount === 0 ? 'unavailable' : 'partial';

  return { sources, overallStatus };
}

export { aggregateSources, classifyError };
