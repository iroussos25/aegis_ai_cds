import { generateGoogleText } from "@/lib/google-text";
import { validateServerEnv } from "@/lib/env";
import { writeAuditLog } from "@/lib/security/audit";
import { runSecurityGuard } from "@/lib/security/guard";
import { parseAndValidateJson } from "@/lib/security/parse";
import { createJsonError, createTextResponse, getRequestId } from "@/lib/security/response";
import { ClinicalReviewRequestSchema } from "@/lib/security/schemas";

type ExternalEvidenceInput = {
  title?: string;
  abstractSnippet?: string;
  journal?: string;
  publishedAt?: string;
  sourceLabel?: string;
};

type ClinicalReviewInputMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are a clinical review assistant for research-oriented clinical decision support exploration.

Rules you must follow:
1. ONLY use the provided clinical note context and the provided external literature snippets. Do not use outside medical knowledge, web knowledge, or unstated assumptions beyond those sources.
2. You may synthesize trends and describe patterns as potential clinical concerns, possible diagnoses to consider, or possible next clinical considerations, but never present them as confirmed diagnoses or final treatment orders.
3. You must make uncertainty explicit. If the note does not contain enough evidence, say so clearly.
4. You must not provide definitive medical advice, medication orders, or instructions that imply autonomous clinical decision-making.
5. Keep the tone professional and analytically useful for a clinician reviewer.
6. Use concise markdown headings when helpful.
7. Ground every important claim in facts stated in the note or in the external literature context.
8. Be explicit that external literature is general evidence and may not be patient-specific.
9. Remind the reader when data appears incomplete, ambiguous, or conflicting.
10. Do not use LaTeX or math delimiters in output. Never use $, $$, \\(, \\), \\[, \\], or \\text{...}; use plain clinical text and standard markdown only.

Preferred structure when the prompt is broad:
## Observed Trends
## Potential Clinical Concerns
## Possible Next Clinical Considerations
## Missing Data / Uncertainty
## Supporting Evidence From Note
## Supporting External Literature

Final line requirement:
Add this exact sentence at the end of every response: "For clinical decision support research only. Not for diagnostic use. Verify with a licensed healthcare professional."`;

export async function POST(req: Request) {
  const requestId = getRequestId();
  const startedAt = Date.now();

  try {
    validateServerEnv("ai");
  } catch (error) {
    return createJsonError(
      req,
      500,
      error instanceof Error ? error.message : "Environment validation failed",
      requestId
    );
  }

  const guard = await runSecurityGuard(req, requestId, {
    routeKey: "clinical-review",
    maxRequests: 30,
    windowMs: 60_000,
  });

  if (!guard.ok) {
    await writeAuditLog({
      route: "/api/clinical-review",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: guard.response.status,
      durationMs: Date.now() - startedAt,
      error: "security_guard_rejected",
    });
    return guard.response;
  }

  const parsed = await parseAndValidateJson(req, ClinicalReviewRequestSchema);
  if (!parsed.ok) {
    await writeAuditLog({
      route: "/api/clinical-review",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: 400,
      durationMs: Date.now() - startedAt,
      error: parsed.message,
    });
    return createJsonError(req, 400, parsed.message, requestId);
  }

  const noteContext = parsed.data.noteContext;
  const externalEvidence = parsed.data.externalEvidence as ExternalEvidenceInput[];
  const messages = parsed.data.messages as ClinicalReviewInputMessage[];

  const cleanNoteContext = noteContext.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  const cleanExternalContext = externalEvidence
    .map((item, index) => {
      const title = typeof item.title === "string" ? item.title.trim() : "Untitled source";
      const abstractSnippet =
        typeof item.abstractSnippet === "string" ? item.abstractSnippet.trim() : "";
      const journal = typeof item.journal === "string" ? item.journal.trim() : "Unknown journal";
      const publishedAt =
        typeof item.publishedAt === "string" ? item.publishedAt.trim() : "Unknown date";
      const sourceLabel =
        typeof item.sourceLabel === "string" ? item.sourceLabel.trim() : "External literature";

      if (!abstractSnippet) {
        return null;
      }

      return `[literature ${index + 1} | ${sourceLabel} | ${journal} | ${publishedAt}]\nTitle: ${title}\nAbstract: ${abstractSnippet}`;
    })
    .filter((item): item is string => Boolean(item))
    .join("\n\n");

  const cleanMessages = messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role,
      content: message.content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim(),
    }));

  if (cleanMessages.length === 0) {
    await writeAuditLog({
      route: "/api/clinical-review",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: 400,
      durationMs: Date.now() - startedAt,
      error: "No valid messages after sanitization",
    });
    return createJsonError(req, 400, "No valid messages after sanitization", requestId);
  }

  try {
    const result = await generateGoogleText({
      system: `${SYSTEM_PROMPT}\n\n<clinical_note_context>\n${cleanNoteContext}\n</clinical_note_context>${
        cleanExternalContext
          ? `\n\n<external_literature_context>\n${cleanExternalContext}\n</external_literature_context>`
          : ""
      }`,
      messages: cleanMessages,
    });

    const response = createTextResponse(req, 200, result.text, requestId, {
      "X-Model-Used": result.model,
    });

    await writeAuditLog({
      route: "/api/clinical-review",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: response.status,
      durationMs: Date.now() - startedAt,
      modelUsed: result.model,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clinical review failed";
    await writeAuditLog({
      route: "/api/clinical-review",
      method: "POST",
      requestId,
      ip: guard.ip,
      status: 500,
      durationMs: Date.now() - startedAt,
      error: message,
    });
    return createJsonError(req, 500, message, requestId);
  }
}
