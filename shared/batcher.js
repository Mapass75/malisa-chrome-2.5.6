export function chunkBlocks(blocks, batchSize, maxChars = 32000) {
  if (!blocks.length) return [];

  const totalChars = blocks.reduce((s, b) => s + b.text.length, 0);
  if (totalChars <= maxChars && blocks.length <= batchSize) {
    return [blocks];
  }

  const chunks = [];
  let current = [];
  let chars = 0;

  for (const block of blocks) {
    const blockLen = block.text.length;
    const overCount = current.length >= batchSize;
    const overChars = current.length > 0 && chars + blockLen > maxChars;

    if (overCount || overChars) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(block);
    chars += blockLen;
  }

  if (current.length) chunks.push(current);
  return chunks;
}

export async function runConcurrent(items, concurrency, fn, onProgress) {
  if (!items.length) return [];

  const results = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
      completed++;
      onProgress?.(completed, items.length);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
