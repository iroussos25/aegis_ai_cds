import { RecruiterKit } from "@/features/clinical/types";

export const ACCEPTED = ".pdf,.txt,.csv,.md,.xml,.json,.tsv,.hl7";
export const STORAGE_KEY = "clinical-analyst-state-v2";

export const RECRUITER_KITS: RecruiterKit[] = [
  {
    id: "discharge-summary",
    title: "Discharge Summary Review",
    summary: "Medication reconciliation plus follow-up verification use case.",
    samplePdfPath: "/samples/sample-discharge-summary.pdf",
    sampleContext: `Patient: Maria Chen (DOB: 1978-02-11)
MRN: 4459012
Admit Date: 2026-01-09
Discharge Date: 2026-01-13
Primary Diagnosis: Community-acquired pneumonia
Comorbidities: Type 2 diabetes mellitus, hypertension
Imaging: CXR showed right lower lobe infiltrate
Lab highlights: WBC 13.1 K/uL on admission -> 8.2 K/uL at discharge
Creatinine remained stable at 0.9 mg/dL
Treatment: Ceftriaxone IV then oral azithromycin
Discharge meds: azithromycin 250 mg daily x 3 days
Follow-up: PCP visit in 7 days, repeat chest x-ray in 6 weeks`,
    prompts: [
      "List all discharge medications and associated durations.",
      "What objective evidence suggests improvement before discharge?",
      "Identify follow-up actions and their timelines.",
    ],
  },
  {
    id: "lab-trend",
    title: "Lab Trend Integrity Check",
    summary: "Flag abnormal values and compare with plan-of-care alignment.",
    samplePdfPath: "/samples/sample-lab-trend-report.pdf",
    sampleContext: `Patient: Derek Wallace (DOB: 1965-09-27)
Encounter Date: 2026-02-20
Reason: fatigue and mild dyspnea
CBC: Hgb 9.4 g/dL (low), Hct 29.1% (low), MCV 72 fL (low)
Iron studies: ferritin 8 ng/mL (low), transferrin saturation 9% (low)
CMP: Na 138, K 4.2, BUN 18, Creatinine 1.0
A1c: 7.8%
TSH: 2.1 mIU/L
Assessment note: Findings consistent with iron deficiency anemia
Plan: start ferrous sulfate 325 mg PO every other day; repeat CBC in 4 weeks`,
    prompts: [
      "Summarize all abnormal labs and their directionality.",
      "Does the documented assessment match the provided labs?",
      "What monitoring steps are explicitly documented in the plan?",
    ],
  },
];
