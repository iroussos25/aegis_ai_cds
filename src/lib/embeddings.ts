const EMBEDDING_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

type EmbedResponse = {
  embedding?: {
    values?: number[];
  };
};

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  }

  const response = await fetch(`${EMBEDDING_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: {
        parts: [{ text }],
      },
    }),
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || `Embedding request failed (${response.status})`);
  }

  const data = (await response.json()) as EmbedResponse;
  const values = data.embedding?.values;

  if (!values || values.length === 0) {
    throw new Error("Embedding response did not include vector values.");
  }

  return values;
}
