import { useCallback, useState } from "react";

import { FhirBundle, FhirMode, FhirResource } from "@/features/clinical/types";

const DEFAULT_FHIR_SERVER = "https://hapi.fhir.org/baseR4";

export function useFhirExplorer() {
  const [fhirServer, setFhirServer] = useState(DEFAULT_FHIR_SERVER);
  const [fhirMode, setFhirMode] = useState<FhirMode>("Patient");
  const [fhirQuery, setFhirQuery] = useState("");
  const [fhirLoading, setFhirLoading] = useState(false);
  const [fhirError, setFhirError] = useState<string | null>(null);
  const [fhirResults, setFhirResults] = useState<FhirResource[]>([]);
  const [fhirCount, setFhirCount] = useState(0);
  const [fhirLastRequestUrl, setFhirLastRequestUrl] = useState<string | null>(null);

  const resetFhirExplorer = useCallback(() => {
    setFhirServer(DEFAULT_FHIR_SERVER);
    setFhirMode("Patient");
    setFhirQuery("");
    setFhirLoading(false);
    setFhirError(null);
    setFhirResults([]);
    setFhirCount(0);
    setFhirLastRequestUrl(null);
  }, []);

  const searchFhir = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!fhirQuery.trim() || !fhirServer.trim()) return;

      setFhirLoading(true);
      setFhirError(null);
      setFhirResults([]);
      setFhirCount(0);

      try {
        const normalizedBase = fhirServer.replace(/\/+$/, "");
        const q = encodeURIComponent(fhirQuery.trim());
        const endpointMap: Record<FhirMode, string> = {
          Patient: `${normalizedBase}/Patient?name=${q}&_count=10`,
          Observation: `${normalizedBase}/Observation?code:text=${q}&_count=10`,
          Condition: `${normalizedBase}/Condition?code:text=${q}&_count=10`,
        };

        const requestUrl = endpointMap[fhirMode];
        setFhirLastRequestUrl(requestUrl);

        const res = await fetch(requestUrl, {
          headers: { Accept: "application/fhir+json, application/json" },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `FHIR request failed (${res.status})`);
        }

        const bundle = (await res.json()) as FhirBundle;
        const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
        const resources = entries
          .map((entry) => entry.resource)
          .filter((resource): resource is FhirResource => Boolean(resource));

        setFhirResults(resources);
        setFhirCount(typeof bundle.total === "number" ? bundle.total : resources.length);
      } catch (error) {
        setFhirError(error instanceof Error ? error.message : "FHIR search failed");
      } finally {
        setFhirLoading(false);
      }
    },
    [fhirMode, fhirQuery, fhirServer]
  );

  const clearFhirResults = useCallback(() => {
    setFhirError(null);
    setFhirResults([]);
    setFhirCount(0);
    setFhirLastRequestUrl(null);
  }, []);

  return {
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
    fhirLastRequestUrl,
    searchFhir,
    clearFhirResults,
    resetFhirExplorer,
  };
}
