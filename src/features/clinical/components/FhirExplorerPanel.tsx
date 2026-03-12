import { Card } from "@/components/ui/Card";
import { FhirMode, FhirResource } from "@/features/clinical/types";

type FhirExplorerPanelProps = {
  fhirServer: string;
  setFhirServer: (value: string) => void;
  fhirMode: FhirMode;
  setFhirMode: (value: FhirMode) => void;
  fhirQuery: string;
  setFhirQuery: (value: string) => void;
  fhirLoading: boolean;
  fhirError: string | null;
  fhirResults: FhirResource[];
  fhirCount: number;
  onSearch: (e: React.FormEvent) => Promise<void>;
};

export function FhirExplorerPanel({
  fhirServer,
  setFhirServer,
  fhirMode,
  setFhirMode,
  fhirQuery,
  setFhirQuery,
  fhirLoading,
  fhirError,
  fhirResults,
  fhirCount,
  onSearch,
}: FhirExplorerPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          FHIR Sandbox Explorer
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
          Query a FHIR server for Patient, Observation, and Condition resources.
        </p>

        <form onSubmit={onSearch} className="space-y-3">
          <input
            value={fhirServer}
            onChange={(e) => setFhirServer(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
            placeholder="FHIR base URL"
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={fhirMode}
              onChange={(e) => setFhirMode(e.target.value as FhirMode)}
              className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
            >
              <option value="Patient">Patient</option>
              <option value="Observation">Observation</option>
              <option value="Condition">Condition</option>
            </select>

            <input
              value={fhirQuery}
              onChange={(e) => setFhirQuery(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
              placeholder="Search term"
            />

            <button
              type="submit"
              disabled={fhirLoading || !fhirQuery.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {fhirLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {fhirError && <p className="mt-3 text-xs text-red-500">Error: {fhirError}</p>}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Results ({fhirCount})
        </h3>

        <div className="mt-3 max-h-130 space-y-2 overflow-y-auto">
          {fhirResults.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No resources loaded yet.</p>
          )}

          {fhirResults.map((resource) => (
            <details
              key={`${resource.resourceType}-${resource.id}`}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              <summary className="cursor-pointer text-sm text-zinc-800 dark:text-zinc-200">
                {resource.resourceType} {resource.id ? `| ${resource.id}` : ""}
              </summary>
              <pre className="mt-2 overflow-x-auto text-xs text-zinc-700 dark:text-zinc-300">
                {JSON.stringify(resource, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
