import { RecruiterKit } from "@/features/clinical/types";
import { ICU_POST_CABG_CONTEXT, ICU_SEPTIC_SHOCK_CONTEXT } from "@/features/clinical/icuContexts";

export const ACCEPTED = ".pdf,.txt,.csv,.md,.xml,.json,.tsv,.hl7";
export const STORAGE_KEY = "clinical-analyst-state-v2";

export const RECRUITER_KITS: RecruiterKit[] = [
  {
    id: "discharge-summary",
    category: "Core Workbench",
    title: "Discharge Summary Review",
    summary: "Medication reconciliation plus follow-up verification use case.",
    sampleAssetPath: "/samples/sample-discharge-summary.pdf",
    sampleAssetLabel: "Open Sample PDF",
    noteLengthLabel: "Short Case",
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
    category: "Core Workbench",
    title: "Lab Trend Integrity Check",
    summary: "Flag abnormal values and compare with plan-of-care alignment.",
    sampleAssetPath: "/samples/sample-lab-trend-report.pdf",
    sampleAssetLabel: "Open Sample PDF",
    noteLengthLabel: "Short Case",
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
  {
    id: "icu-septic-shock",
    category: "ICU Patients",
    title: "ICU Longitudinal Review: Septic Shock and ARDS",
    summary:
      "Multi-week surgical ICU stay with source control, ARDS, CRRT, tracheostomy, delirium, and competing complications.",
    sampleAssetPath: "/samples/icu-septic-shock-case.txt",
    sampleAssetLabel: "Download ICU Case File",
    noteLengthLabel: "Long ICU Case",
    scoringRubric: [
      "Timeline fidelity: Correct sequence and date/day alignment for source control, ventilator changes, CRRT, tracheostomy, and transfer milestones.",
      "Complication synthesis: Clearly identifies each major complication, cites objective evidence, and states resolved vs unresolved status at transfer.",
      "Clinical reasoning quality: Distinguishes correlation from causation and explains why major management pivots occurred.",
      "Grounding and traceability: Uses specific chart facts/labs/events from the note rather than generic ICU language.",
    ],
    sampleContext: ICU_SEPTIC_SHOCK_CONTEXT,
    prompts: [
      "Build a day-by-day ICU timeline covering shock, ventilation, renal replacement therapy, and source control.",
      "Which events most strongly justified tracheostomy, and what objective evidence shows the patient was improving by transfer?",
      "Summarize every major complication, when it appeared, and whether it was resolved or still active at transfer.",
    ],
  },
  {
    id: "icu-post-cabg",
    category: "ICU Patients",
    title: "ICU Longitudinal Review: Post-CABG Cardiogenic Shock",
    summary:
      "Complex cardiothoracic ICU course with VA-ECMO, CRRT, embolic strokes, GI bleeding, failed extubation, and recovery planning.",
    sampleAssetPath: "/samples/icu-post-cabg-case.txt",
    sampleAssetLabel: "Download ICU Case File",
    noteLengthLabel: "Long ICU Case",
    scoringRubric: [
      "Hemodynamic support accuracy: Correctly tracks rationale and timing of IABP, VA-ECMO, inotropes, decannulation, and recovery signals.",
      "Risk balancing analysis: Explains anticoagulation decisions in context of stroke, bleeding, and postoperative instability.",
      "Cross-domain integration: Connects cardiology, neurologic, renal, respiratory, and GI events into a coherent ICU narrative.",
      "Transfer readiness assessment: Uses explicit objective findings to justify why CTICU transfer was appropriate despite residual risk.",
    ],
    sampleContext: ICU_POST_CABG_CONTEXT,
    prompts: [
      "Create a concise but complete timeline of hemodynamic support, including when VA-ECMO, IABP, inotropes, and CRRT were started and stopped.",
      "Explain how the team balanced anticoagulation against bleeding and stroke risk across the ICU stay.",
      "What unresolved clinical risks remained at transfer, and what evidence shows the patient had recovered enough to leave the CTICU?",
    ],
  },
];
