import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Clone headers so we can add user ID
  const requestHeaders = new Headers(request.headers);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  console.log("Middleware auth check:", { user: user?.id, error: error?.message, path: request.nextUrl.pathname });

  // Redirect unauthenticated users to login for protected routes
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    console.log("Redirecting to login - no user found");
    return NextResponse.redirect(url);
  }

  // Pass user ID to server components via request header
  requestHeaders.set("x-user-id", user.id);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
