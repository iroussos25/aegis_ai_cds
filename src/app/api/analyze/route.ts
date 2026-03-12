import { generateGoogleText } from "@/lib/google-text";

const SYSTEM_PROMPT = `You are a Clinical Data Integrity Specialist. Your sole responsibility is to analyze and answer questions based strictly on the clinical document context provided below.

Rules you must follow:
1. ONLY use information explicitly stated in the provided context. Do not use any prior medical knowledge or training data to supplement your answers.
2. If the answer cannot be found in the context, respond with: "The provided clinical document does not contain sufficient information to answer this question."
3. When referencing data from the context, be precise — cite specific values, dates, findings, or terminology exactly as they appear.
4. Do not speculate, infer beyond what is written, or provide differential diagnoses unless they are explicitly mentioned in the context.
5. Maintain a professional, concise tone appropriate for clinical data review.
6. If the context contains ambiguous or potentially conflicting information, flag it explicitly rather than choosing one interpretation silently.`;

export async function POST(req: Request) {
  const body = await req.json();
  const { prompt, context } = body;

  if (
    typeof prompt !== "string" ||
    typeof context !== "string" ||
    !prompt.trim() ||
    !context.trim()
  ) {
    return new Response("Invalid input", { status: 400 });
  }

  // Sanitize inputs: strip null bytes and dangerous control characters
  const cleanPrompt = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  const cleanContext = context.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();

  try {
    const result = await generateGoogleText({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `<clinical_document_context>\n${cleanContext}\n</clinical_document_context>\n\nQuestion: ${cleanPrompt}`,
        },
      ],
    });

    return new Response(result.text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Model-Used": result.model,
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Clinical analysis failed",
      { status: 500 }
    );
  }
}
