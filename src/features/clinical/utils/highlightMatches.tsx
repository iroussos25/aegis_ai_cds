export function highlightMatches(text: string, query: string) {
  if (!query.trim()) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={index} className="rounded bg-indigo-200/60 px-0.5 dark:bg-indigo-500/30">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
