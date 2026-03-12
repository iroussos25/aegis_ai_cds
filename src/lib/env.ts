import { z } from "zod";

type EnvScope = "core" | "ai" | "retrieval";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  APP_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_API_KEY: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
});

const validatedScopes = new Set<string>();

function nonEmpty(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function requiredKeysForScope(scope: EnvScope): string[] {
  if (scope === "ai") {
    return ["GOOGLE_GENERATIVE_AI_API_KEY"];
  }

  if (scope === "retrieval") {
    return [
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ];
  }

  return [];
}

export function validateServerEnv(scope: EnvScope) {
  const cacheKey = `${scope}:${process.env.NODE_ENV ?? "development"}`;
  if (validatedScopes.has(cacheKey)) return;

  const env = EnvSchema.parse(process.env);
  const missing = requiredKeysForScope(scope).filter((key) => !nonEmpty(env[key as keyof typeof env]));

  if (env.NODE_ENV === "production") {
    if (!nonEmpty(env.APP_API_KEY)) {
      missing.push("APP_API_KEY");
    }

    if (!nonEmpty(env.CORS_ALLOWED_ORIGINS)) {
      missing.push("CORS_ALLOWED_ORIGINS");
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${Array.from(new Set(missing)).join(", ")}`);
  }

  validatedScopes.add(cacheKey);
}
