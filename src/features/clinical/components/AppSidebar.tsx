import { Card } from "@/components/ui/Card";
import { Panel } from "@/features/clinical/types";

type SidebarProps = {
  activePanel: Panel;
  setActivePanel: (panel: Panel) => void;
};

const ITEMS: { key: Panel; label: string }[] = [
  { key: "workbench", label: "Clinical Workbench" },
  { key: "clinical-review", label: "Clinical Review" },
  { key: "recruiter-kit", label: "Recruiter Test Kits" },
  { key: "fhir", label: "FHIR Explorer (Beta)" },
];

export function AppSidebar({ activePanel, setActivePanel }: SidebarProps) {
  return (
    <Card className="h-fit p-3 lg:sticky lg:top-6">
      <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Workspace
      </div>

      <div className="space-y-1">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActivePanel(item.key)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              activePanel === item.key
                ? "bg-indigo-600 text-white"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
        Tip: Load a recruiter kit, summarize it in Workbench, then move into Clinical Review for higher-level follow-up questions.
      </div>
    </Card>
  );
}
