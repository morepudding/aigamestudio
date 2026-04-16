import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Routes exemptées du blocage (onboarding Eve + API)
const EXEMPT_PREFIXES = [
  "/collaborateur/eve/onboarding",
  "/api/",
  "/_next/",
  "/favicon",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip exempt routes
  if (EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Check Eve's status
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Can't check — allow through to avoid breaking app on misconfiguration
    return NextResponse.next();
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: eve } = await supabase
    .from("agents")
    .select("status")
    .eq("slug", "eve")
    .single();

  if (!eve || eve.status !== "actif") {
    return NextResponse.redirect(new URL("/collaborateur/eve/onboarding", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /api/ (API routes)
     * - /_next/ (Next.js internals)
     * - /favicon.ico
     * - Static files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
