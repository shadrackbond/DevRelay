import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isWorkspaceId, WORKSPACE_COOKIE } from "./app/lib/workspace";

export function proxy(request: NextRequest) {
  if (isWorkspaceId(request.cookies.get(WORKSPACE_COOKIE)?.value)) return NextResponse.next();
  const workspaceId = randomUUID();
  request.cookies.set(WORKSPACE_COOKIE, workspaceId);
  const headers = new Headers(request.headers);
  headers.set("cookie", request.cookies.toString());
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
