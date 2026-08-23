// Generic timeout + retry primitives. Not aware of any particular source's
// wire format — source clients layer their own error classification on top.

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, { timeoutMs = 5000, fetchImpl = fetch, ...fetchOptions } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(attemptFn, {
  maxAttempts = 3,
  baseDelayMs = 300,
  sleepImpl = sleep,
  isRetryable = () => true,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await attemptFn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * backoff * 0.5;
      await sleepImpl(backoff + jitter);
    }
  }
  throw lastError;
}

export { sleep, fetchWithTimeout, withRetry };
