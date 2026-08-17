import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PAINEL_COOKIE, pinValido } from "@/lib/painel-auth";

// S3: /painel/* exige cookie de sessão válido; /painel (login) fica de fora.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/painel") return NextResponse.next();

  const cookie = request.cookies.get(PAINEL_COOKIE)?.value;
  if (!pinValido(cookie)) {
    return NextResponse.redirect(new URL("/painel", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/painel/:path*",
};
