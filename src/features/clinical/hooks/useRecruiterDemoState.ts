import { useCallback, useState } from "react";

import { RecruiterKit } from "@/features/clinical/types";

export function useRecruiterDemoState() {
  const [rubricScores, setRubricScores] = useState<Record<string, Record<number, number>>>({});
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(1);

  const setRubricScore = useCallback((kitId: string, criterionIndex: number, score: number) => {
    setRubricScores((prev) => ({
      ...prev,
      [kitId]: {
        ...(prev[kitId] ?? {}),
        [criterionIndex]: score,
      },
    }));
  }, []);

  const clearKitRubricScores = useCallback((kitId: string) => {
    setRubricScores((prev) => {
      const next = { ...prev };
      delete next[kitId];
      return next;
    });
  }, []);

  const clearAllRubricScores = useCallback(() => {
    setRubricScores({});
  }, []);

  const startDemoMode = useCallback((kit?: RecruiterKit, onLoadKit?: (kit: RecruiterKit) => void) => {
    setDemoMode(true);
    setDemoStep(1);

    if (kit && onLoadKit) {
      onLoadKit(kit);
    }
  }, []);

  const advanceDemoStep = useCallback(() => {
    setDemoStep((prev) => Math.min(prev + 1, 4));
  }, []);

  const stopDemoMode = useCallback(() => {
    setDemoMode(false);
    setDemoStep(1);
  }, []);

  const resetDemoState = useCallback(() => {
    setDemoMode(false);
    setDemoStep(1);
  }, []);

  return {
    rubricScores,
    setRubricScore,
    clearKitRubricScores,
    clearAllRubricScores,
    demoMode,
    demoStep,
    startDemoMode,
    advanceDemoStep,
    stopDemoMode,
    resetDemoState,
  };
}
