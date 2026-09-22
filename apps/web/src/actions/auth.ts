"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@aperture/database";
import { signIn, signOut } from "@/auth";
import { rateLimit } from "@/server/redis";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(1).max(80),
  organization: z.string().min(2).max(80),
});

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const allowed = await rateLimit(`login:${parsed.data.email}`, 8, 60);
  if (!allowed) return { error: "Too many attempts. Wait a minute." };

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
}

export async function signupAction(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    organization: formData.get("organization"),
  });
  if (!parsed.success) return { error: "Check the form and try again." };

  const allowed = await rateLimit(`signup:${parsed.data.email}`, 5, 300);
  if (!allowed) return { error: "Too many attempts." };

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const slug = slugify(parsed.data.organization);
  const slugTaken = await prisma.organization.findUnique({ where: { slug } });
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash: await hash(parsed.data.password, 12),
    },
  });
  const org = await prisma.organization.create({
    data: {
      name: parsed.data.organization,
      slug: slugTaken ? `${slug}-${user.id.slice(-6)}` : slug,
    },
  });
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: user.id, role: "OWNER" },
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Account created, but sign-in failed." };
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "org";
}
