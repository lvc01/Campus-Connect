import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`
  : "http://localhost:8001/api/v1/auth/refresh";

/**
 * POST /api/v1/auth/refresh
 *
 * Proxies the token-refresh call to the backend, forwarding the
 * browser's cookies (including cc_refresh_token) and rewriting any
 * Set-Cookie headers back onto the same-origin response so the browser
 * stores them against localhost:3000 (the Next.js origin).
 *
 * This is necessary because Next.js rewrites do not reliably forward
 * Set-Cookie headers for httpOnly cookies that are path-scoped on the
 * backend domain.
 */
export async function POST(request: NextRequest) {
  // Forward all cookies the browser sent to the backend
  const cookieHeader = request.headers.get("cookie") ?? "";

  let backendRes: Response;
  try {
    backendRes = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Unable to reach authentication server." },
      { status: 502 }
    );
  }

  const body = await backendRes.json().catch(() => ({}));

  const nextRes = NextResponse.json(body, { status: backendRes.status });

  // Forward every Set-Cookie header the backend returned
  backendRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      nextRes.headers.append("set-cookie", value);
    }
  });

  return nextRes;
}
