import { streamText } from "ai";
import { google } from "@ai-sdk/google";

type ClinicalReviewInputMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are a clinical review assistant for research-oriented clinical decision support exploration.

Rules you must follow:
1. ONLY use the provided clinical note context. Do not use outside medical knowledge, web knowledge, or unstated assumptions.
2. You may synthesize trends and describe patterns as potential clinical concerns, possible diagnoses to consider, or possible next clinical considerations, but never present them as confirmed diagnoses or final treatment orders.
3. You must make uncertainty explicit. If the note does not contain enough evidence, say so clearly.
4. You must not provide definitive medical advice, medication orders, or instructions that imply autonomous clinical decision-making.
5. Keep the tone professional and analytically useful for a clinician reviewer.
6. Use concise markdown headings when helpful.
7. Ground every important claim in facts stated in the note.
8. Remind the reader when data appears incomplete, ambiguous, or conflicting.

Preferred structure when the prompt is broad:
## Observed Trends
## Potential Clinical Concerns
## Possible Next Clinical Considerations
## Missing Data / Uncertainty
## Supporting Evidence From Note

Final line requirement:
Add this exact sentence at the end of every response: "For clinical decision support research only. Not for diagnostic use. Verify with a licensed healthcare professional."`;

export async function POST(req: Request) {
  const body = await req.json();
  const context = typeof body.context === "string" ? body.context : "";
  const messages = Array.isArray(body.messages) ? (body.messages as ClinicalReviewInputMessage[]) : [];

  if (!context.trim() || messages.length === 0) {
    return new Response("Invalid input", { status: 400 });
  }

  const cleanContext = context.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
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
    return new Response("Invalid input", { status: 400 });
  }

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: `${SYSTEM_PROMPT}\n\n<clinical_note_context>\n${cleanContext}\n</clinical_note_context>`,
    messages: cleanMessages,
  });

  return result.toTextStreamResponse();
}
