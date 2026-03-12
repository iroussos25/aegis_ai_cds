const required = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());

if ((process.env.NODE_ENV || "development") === "production") {
  for (const key of ["APP_API_KEY", "CORS_ALLOWED_ORIGINS"]) {
    if (!process.env[key] || !String(process.env[key]).trim()) {
      missing.push(key);
    }
  }
}

if (missing.length > 0) {
  console.error(`[env] Missing required variables: ${Array.from(new Set(missing)).join(", ")}`);
  process.exit(1);
}

console.log("[env] Environment validation passed.");
