export function createContextSignature(context: string, fileName: string | null) {
  let hash = 0;
  const source = `${fileName ?? "manual"}\n${context}`;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}

export function normalizeClinicalMarkdown(input: string) {
  return input
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\${2,}/g, "");
}
