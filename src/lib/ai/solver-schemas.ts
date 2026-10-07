import { z } from "zod";
import {
  CHOICE_KEYS,
  ORIGINAL_TYPES,
  validateQuizQuestion,
} from "./question-validation.ts";

export const solverInputSchema = z.strictObject({
  id: z.string().min(1).max(40),
  questionText: z.string().min(1).max(8000),
  choices: z.array(z.string().min(1).max(2000)).max(4),
  originalType: z.enum(ORIGINAL_TYPES),
  topic: z.string().max(200).nullable(),
  relevantTheory: z.string().max(2500).nullable(),
  sourceExcerpt: z.string().max(600).nullable(),
});
export type SolverInput = z.infer<typeof solverInputSchema>;
export const solvedQuestionSchema = z.strictObject({
  id: z.string().min(1).max(40),
  correctChoice: z.enum(CHOICE_KEYS).nullable(),
  answerText: z.string().max(2000).nullable(),
  choices: z
    .array(z.string().min(1).max(2000))
    .length(4)
    .or(z.array(z.string()).length(0)),
  explanation: z.string().max(3000),
  confidence: z.number().min(0).max(1),
  status: z.enum(["solved", "uncertain", "invalid"]),
});
export const solvedBatchSchema = z.strictObject({
  results: z.array(solvedQuestionSchema).min(1).max(5),
});
export type SolvedQuestion = z.infer<typeof solvedQuestionSchema>;
export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  totalTokens?: number;
}
export interface SolverProvider {
  readonly model: string;
  readonly name: string;
  healthCheck(): Promise<unknown>;
  solveBatch(
    input: SolverInput[],
    signal: AbortSignal,
  ): Promise<{
    results: SolvedQuestion[];
    usage: AIUsage | null;
    model?: string;
  }>;
}
export function validateSolvedBatch(value: unknown, input: SolverInput[]) {
  const batch = solvedBatchSchema.parse(value);
  if (
    batch.results.length !== input.length ||
    new Set(batch.results.map((result) => result.id)).size !== input.length
  )
    throw new SyntaxError("INVALID_SOLVER_OUTPUT");
  return batch.results.map((result) => {
    const question = input.find((item) => item.id === result.id);
    if (!question) throw new SyntaxError("INVALID_SOLVER_OUTPUT");
    if (
      question.choices.length === 4 &&
      JSON.stringify(question.choices) !== JSON.stringify(result.choices)
    )
      throw new SyntaxError("SOURCE_CHOICES_CHANGED");
    const validated = validateQuizQuestion({
      ...question,
      ...result,
      answerOrigin: "ai_derived",
    });
    return { ...result, ...validated };
  });
}
