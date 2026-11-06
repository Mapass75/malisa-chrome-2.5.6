/**
 * Groups blocks with identical text for a single API call, then maps results back.
 */
export function dedupeBlocks(blocks) {
  const originalIdsByText = new Map();
  const uniqueBlocks = [];

  for (const block of blocks) {
    if (!originalIdsByText.has(block.text)) {
      originalIdsByText.set(block.text, []);
      uniqueBlocks.push({ id: String(uniqueBlocks.length), text: block.text });
    }
    originalIdsByText.get(block.text).push(block.id);
  }

  return {
    uniqueBlocks,
    expandResults(dedupedResults) {
      const byDedupId = new Map(dedupedResults.map((r) => [String(r.id), r.translated]));
      const results = [];

      for (const unique of uniqueBlocks) {
        const translated = byDedupId.get(unique.id);
        if (!translated) continue;
        for (const id of originalIdsByText.get(unique.text)) {
          results.push({ id, translated });
        }
      }

      return results;
    },
    cacheEntries(dedupedResults) {
      const byDedupId = new Map(dedupedResults.map((r) => [String(r.id), r.translated]));
      const entries = [];

      for (const unique of uniqueBlocks) {
        const translated = byDedupId.get(unique.id);
        if (translated && translated !== unique.text) {
          entries.push({ text: unique.text, translation: translated });
        }
      }

      return entries;
    },
  };
}
