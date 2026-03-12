export type Panel = "workbench" | "recruiter-kit" | "fhir";

export type HistoryItem = {
  id: string;
  prompt: string;
  response: string;
  createdAt: string;
};

export type RecruiterKit = {
  id: string;
  title: string;
  summary: string;
  samplePdfPath: string;
  sampleContext: string;
  prompts: string[];
};

export type FhirMode = "Patient" | "Observation" | "Condition";

export type FhirResource = {
  resourceType?: string;
  id?: string;
  [key: string]: unknown;
};

export type FhirBundleEntry = {
  resource?: FhirResource;
};

export type FhirBundle = {
  total?: number;
  entry?: FhirBundleEntry[];
};

export type EvidenceItem = {
  id: string;
  content: string;
  similarity: number;
  chunkIndex: number;
  sourceLabel: string;
};
