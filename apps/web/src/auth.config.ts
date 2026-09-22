import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async () => null,
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/invite") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/internal");
      if (isPublic) return true;
      return Boolean(auth?.user);
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          organizationId: string;
          organizationRole: "OWNER" | "ADMIN" | "MEMBER";
        };
        token.id = u.id;
        token.organizationId = u.organizationId;
        token.organizationRole = u.organizationRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.organizationId =
          typeof token.organizationId === "string" ? token.organizationId : "";
        session.user.organizationRole =
          token.organizationRole === "OWNER" ||
          token.organizationRole === "ADMIN" ||
          token.organizationRole === "MEMBER"
            ? token.organizationRole
            : "MEMBER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
