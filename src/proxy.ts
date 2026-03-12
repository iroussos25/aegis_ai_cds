import { NextResponse, type NextRequest } from "next/server";

import { createCorsHeaders, createSecurityHeaders } from "@/lib/security/headers";

export function proxy(request: NextRequest) {
  const isApiRequest = request.nextUrl.pathname.startsWith("/api/");
  const securityHeaders = createSecurityHeaders();

  if (isApiRequest && request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...securityHeaders,
        ...createCorsHeaders(request),
      },
    });
  }

  const response = NextResponse.next();

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  if (isApiRequest) {
    const corsHeaders = createCorsHeaders(request);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
