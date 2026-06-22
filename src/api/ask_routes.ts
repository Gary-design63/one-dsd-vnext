// =====================================================================
// One DSD vNext — Ask API (Layer 9). POST /api/ask {question} -> AskResult.
// Auth required; retrieval is visibility-gated; never fabricates.
// =====================================================================
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { readJsonBody, sendJson } from "../http/http.js";
import { ask } from "../ask/answer.js";

interface AskBody { question?: unknown }

export async function handleAsk(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const viewer = await requireAuth(db, req, res);
  if (!viewer) return;
  let body: AskBody | null;
  try {
    body = await readJsonBody<AskBody>(req);
  } catch {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    sendJson(res, 400, { error: "missing_question" });
    return;
  }
  if (question.length > 2000) {
    sendJson(res, 413, { error: "question_too_long" });
    return;
  }
  const result = await ask(db, { viewer, question });
  sendJson(res, 200, result);
}
