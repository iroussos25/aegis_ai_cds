export function chunkText(input: string, chunkSize = 1200, overlap = 220) {
  const text = input.trim();
  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    const chunk = text.slice(start, end).trim();

    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;

    start = Math.max(0, end - overlap);
  }

  return chunks;
}
