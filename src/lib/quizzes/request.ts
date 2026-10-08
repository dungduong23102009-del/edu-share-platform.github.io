import { z } from "zod";
export const createQuizSchema = z
  .object({
    id: z.uuid(),
    documentId: z.uuid(),
    topicIds: z.array(z.uuid()).max(50),
    count: z.union([
      z.literal(10),
      z.literal(20),
      z.literal(30),
      z.literal(50),
      z.literal("all"),
    ]),
    random: z.boolean(),
  })
  .strict();
export const progressSchema = z
  .object({ answers: z.record(z.uuid(), z.enum(["A", "B", "C", "D"])) })
  .strict();
export const retrySchema = z
  .object({ quizId: z.uuid(), mode: z.enum(["wrong", "all"]) })
  .strict();
export async function boundedJson(request: Request) {
  if (!request.body) throw new SyntaxError("EMPTY");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new SyntaxError("TOO_LARGE");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
