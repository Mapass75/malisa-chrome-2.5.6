export function httpStatusError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function isRetryableError(err) {
  const status = err?.status;
  if (status != null) return status === 429 || status === 456 || (status >= 500 && status < 600);
  return err instanceof TypeError || /failed to fetch|network|timed? ?out/i.test(err?.message ?? '');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Exponential backoff: 1s, 2s, 4s — max `attempts` tries total.
export async function withRetry(fn, attempts = 3, baseMs = 1000) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || !isRetryableError(err)) throw err;
      await sleep(baseMs * 2 ** (i - 1));
    }
  }
}
