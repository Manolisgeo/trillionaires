import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      organizationId: string;
      organizationRole: "OWNER" | "ADMIN" | "MEMBER";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    organizationId?: string;
    organizationRole?: "OWNER" | "ADMIN" | "MEMBER";
  }
}

export {};
