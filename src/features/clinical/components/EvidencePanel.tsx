import { Card } from "@/components/ui/Card";
import { EvidenceItem } from "@/features/clinical/types";

type EvidencePanelProps = {
  evidence: EvidenceItem[];
};

export function EvidencePanel({ evidence }: EvidencePanelProps) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <Card className="border-cyan-100 dark:border-cyan-900/40">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
        Evidence and Citations
      </h2>

      <div className="space-y-3">
        {evidence.map((item) => (
          <details
            key={item.id}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <summary className="cursor-pointer text-sm text-zinc-800 dark:text-zinc-200">
              Chunk {item.chunkIndex} | score {item.similarity.toFixed(3)} | source {item.sourceLabel}
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
              {item.content}
            </p>
          </details>
        ))}
      </div>
    </Card>
  );
}
