import { getSupabaseServerClient } from "@/lib/supabase-server";
import { recordApiMetric } from "@/lib/observability/metrics";

type AuditInput = {
  route: string;
  method: string;
  requestId: string;
  ip: string;
  status: number;
  durationMs: number;
  error?: string;
  modelUsed?: string;
};

export async function writeAuditLog(input: AuditInput) {
  const payload = {
    route: input.route,
    method: input.method,
    request_id: input.requestId,
    client_ip: input.ip,
    status_code: input.status,
    duration_ms: input.durationMs,
    error_message: input.error ?? null,
    created_at: new Date().toISOString(),
  };

  console.info("[api_audit]", payload);

  recordApiMetric({
    route: input.route,
    status: input.status,
    durationMs: input.durationMs,
    modelUsed: input.modelUsed,
  });

  if (process.env.ENABLE_DB_AUDIT_LOGS !== "true") {
    return;
  }

  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("api_audit_logs").insert(payload);
  } catch {
    // Best-effort logging only. We never fail request flow due to audit insert failure.
  }
}
