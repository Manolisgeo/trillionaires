import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { background, parseJson, route } from "../_lib/http";
import { draftRoleProfile, isMockMode } from "@/lib/prep";

const Body = z.object({ title: z.string().trim().min(1).max(200), company: z.string().trim().min(1).max(200), jdText: z.string().trim().min(20, "Job description is too short").max(60000) });

export const GET = route(async () => NextResponse.json({ roles: (await store.roles.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }));

export const POST = route(async (req) => {
  const input = await parseJson(req, Body);
  const role = await store.roles.create({ ...input, status: "drafting", profile: null, ...(isMockMode() ? { demoData: true } : {}) });
  // Failure leaves status "draft" with profile null (Role has no error field; see NOTES-api.md).
  background("role-draft", async () => {
    const profile = await draftRoleProfile(input);
    await store.roles.update(role.id, { profile, status: "draft" });
  }, async (message) => {
    await store.roles.update(role.id, { status: "draft", profile: null, draftError: message });
  });
  return NextResponse.json({ role }, { status: 201 });
});
