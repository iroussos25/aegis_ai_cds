type RouteMetric = {
  requests: number;
  errors: number;
  totalDurationMs: number;
  lastStatus: number;
  lastUpdatedAt: string;
};

type ModelMetric = {
  count: number;
  errors: number;
};

const routeMetrics = new Map<string, RouteMetric>();
const modelMetrics = new Map<string, ModelMetric>();

export function recordApiMetric(input: {
  route: string;
  status: number;
  durationMs: number;
  modelUsed?: string;
}) {
  const existing = routeMetrics.get(input.route);

  const next: RouteMetric = {
    requests: (existing?.requests ?? 0) + 1,
    errors: (existing?.errors ?? 0) + (input.status >= 400 ? 1 : 0),
    totalDurationMs: (existing?.totalDurationMs ?? 0) + Math.max(0, input.durationMs),
    lastStatus: input.status,
    lastUpdatedAt: new Date().toISOString(),
  };

  routeMetrics.set(input.route, next);

  if (input.modelUsed) {
    const model = modelMetrics.get(input.modelUsed);
    modelMetrics.set(input.modelUsed, {
      count: (model?.count ?? 0) + 1,
      errors: (model?.errors ?? 0) + (input.status >= 400 ? 1 : 0),
    });
  }
}

export function getMetricsSnapshot() {
  const routes = Array.from(routeMetrics.entries()).map(([route, value]) => ({
    route,
    requests: value.requests,
    errors: value.errors,
    errorRate: value.requests > 0 ? Number((value.errors / value.requests).toFixed(4)) : 0,
    averageDurationMs:
      value.requests > 0 ? Math.round(value.totalDurationMs / value.requests) : 0,
    lastStatus: value.lastStatus,
    lastUpdatedAt: value.lastUpdatedAt,
  }));

  const models = Array.from(modelMetrics.entries()).map(([model, value]) => ({
    model,
    count: value.count,
    errors: value.errors,
    errorRate: value.count > 0 ? Number((value.errors / value.count).toFixed(4)) : 0,
  }));

  return {
    generatedAt: new Date().toISOString(),
    routes,
    models,
  };
}

export function resetMetricsForTest() {
  routeMetrics.clear();
  modelMetrics.clear();
}
