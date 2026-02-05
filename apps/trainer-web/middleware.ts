import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Public routes that don't need auth checks
const publicRoutes = ["/", "/login", "/signup", "/api/"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip auth for public routes - makes them instant
  if (publicRoutes.some(route => path === route || path.startsWith(route))) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
