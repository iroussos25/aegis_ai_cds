type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-lite-latest",
  "gemma-3-4b-it",
  "gemma-3-12b-it",
  "gemma-3-1b-it",
] as const;

type GoogleCandidateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type GoogleContent = {
  role: "user" | "model";
  parts: Array<{
    text: string;
  }>;
};

function toGoogleRole(role: ChatMessage["role"]) {
  return role === "assistant" ? "model" : "user";
}

function extractText(response: GoogleCandidateResponse) {
  return (
    response.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function buildInlineSystemMessage(system: string) {
  return {
    role: "user" as const,
    parts: [
      {
        text: `System instructions:\n${system}\n\nAcknowledge and follow these instructions for the rest of this conversation.`,
      },
    ],
  };
}

function buildContents(messages: ChatMessage[]): GoogleContent[] {
  return messages.map((message) => ({
    role: toGoogleRole(message.role),
    parts: [{ text: message.content }],
  }));
}

function buildRequestBody(options: { system: string; messages: ChatMessage[] }, useSystemInstruction: boolean) {
  const contents = buildContents(options.messages);

  if (!useSystemInstruction) {
    return {
      contents: [buildInlineSystemMessage(options.system), ...contents],
    };
  }

  return {
    systemInstruction: {
      parts: [{ text: options.system }],
    },
    contents,
  };
}

function supportsSystemInstruction(model: (typeof FALLBACK_MODELS)[number]) {
  return !model.startsWith("gemma-");
}

export async function generateGoogleText(options: {
  system: string;
  messages: ChatMessage[];
}) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  }

  let lastError = "Google text generation failed";

  for (const model of FALLBACK_MODELS) {
    const requestModes = supportsSystemInstruction(model) ? [true, false] : [false];

    for (const useSystemInstruction of requestModes) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildRequestBody(options, useSystemInstruction)),
        }
      );

      const data = (await response.json()) as GoogleCandidateResponse;

      if (!response.ok) {
        lastError = data.error?.message || `Google generation failed (${response.status})`;

        const developerInstructionUnsupported =
          response.status === 400 &&
          /developer instruction is not enabled/i.test(lastError) &&
          useSystemInstruction;

        if (developerInstructionUnsupported) {
          continue;
        }

        if (response.status === 429 || response.status === 503) {
          break;
        }

        throw new Error(lastError);
      }

      const text = extractText(data);
      if (text) {
        return {
          text,
          model,
        };
      }

      lastError = data.error?.message || `Model ${model} returned no visible content.`;
    }
  }

  throw new Error(lastError);
}
