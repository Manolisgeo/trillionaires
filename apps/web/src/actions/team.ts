"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@aperture/database";
import { signIn } from "@/auth";
import { requireOrg } from "@/server/org";
import { writeAudit } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export async function inviteMemberAction(
  _prev: { error?: string; invitePath?: string } | undefined,
  formData: FormData,
) {
  const org = await requireOrg();
  if (org.role !== "OWNER" && org.role !== "ADMIN") {
    return { error: "Only owners and admins can invite people." };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Enter a valid email and role." };

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { organizationId: org.organizationId } } },
  });
  if (existingUser?.memberships.length) {
    return { error: "That person is already in this organization." };
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");

  await prisma.organizationInvite.upsert({
    where: {
      organizationId_email: { organizationId: org.organizationId, email },
    },
    update: {
      role: parsed.data.role,
      token,
      expiresAt,
      acceptedAt: null,
      invitedById: org.userId,
    },
    create: {
      organizationId: org.organizationId,
      email,
      role: parsed.data.role,
      token,
      expiresAt,
      invitedById: org.userId,
    },
  });

  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "organization.invite",
    resourceType: "OrganizationInvite",
    metadata: { email, role: parsed.data.role },
  });

  revalidatePath("/settings");
  return { invitePath: `/invite/${token}` };
}

const acceptSchema = z.object({
  token: z.string().min(20),
  name: z.string().min(1).max(80),
  password: z.string().min(8),
});

export async function acceptInviteAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Check the form and try again." };

  const invite = await prisma.organizationInvite.findUnique({
    where: { token: parsed.data.token },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return { error: "This invite is invalid or has expired." };
  }

  const email = invite.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    if (!user.passwordHash) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: parsed.data.name, passwordHash: await hash(parsed.data.password, 12) },
      });
    } else {
      const { compare } = await import("bcryptjs");
      const valid = await compare(parsed.data.password, user.passwordHash);
      if (!valid) return { error: "That email already has an account. Use the existing password." };
      if (parsed.data.name && !user.name) {
        await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
      }
    }
  } else {
    user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash: await hash(parsed.data.password, 12),
      },
    });
  }

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: invite.organizationId, userId: user.id },
    },
    update: { role: invite.role },
    create: {
      organizationId: invite.organizationId,
      userId: user.id,
      role: invite.role,
    },
  });

  await prisma.organizationInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  await writeAudit({
    organizationId: invite.organizationId,
    userId: user.id,
    action: "organization.invite.accept",
    resourceType: "Organization",
    resourceId: invite.organizationId,
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Joined, but sign-in failed. Use the login page." };
    throw error;
  }
}

export async function revokeInviteAction(inviteId: string) {
  const org = await requireOrg();
  if (org.role !== "OWNER" && org.role !== "ADMIN") {
    throw new Error("Only owners and admins can revoke invites.");
  }
  await prisma.organizationInvite.deleteMany({
    where: { id: inviteId, organizationId: org.organizationId, acceptedAt: null },
  });
  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "organization.invite.revoke",
    resourceType: "OrganizationInvite",
    resourceId: inviteId,
  });
  revalidatePath("/settings");
}

export async function removeMemberAction(memberId: string) {
  const org = await requireOrg();
  if (org.role !== "OWNER" && org.role !== "ADMIN") {
    throw new Error("Only owners and admins can remove members.");
  }
  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: org.organizationId },
  });
  if (!member) return;
  if (member.userId === org.userId) throw new Error("You cannot remove yourself.");
  if (member.role === "OWNER") throw new Error("Owners cannot be removed.");
  await prisma.organizationMember.delete({ where: { id: member.id } });
  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "organization.member.remove",
    resourceType: "OrganizationMember",
    resourceId: member.id,
  });
  revalidatePath("/settings");
}
