export const SOLVER_SETTINGS = {
  minimumConfidence: 0.65,
  cautionConfidence: 0.85,
  batchSize: 5,
  batchCharacters: 18000,
  concurrency: 2,
  maxQuestions: 50,
  workerTimeoutMs: 180000,
} as const;
