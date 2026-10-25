import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { type Ctx, HttpError, route } from "../../../_lib/http";

export const POST = route(async (_req, { params }: Ctx) => {
  const { id } = await params;
  const role = await store.roles.get(id);
  if (!role) throw new HttpError(404, "Role not found");
  if (!role.profile) throw new HttpError(409, role.status === "drafting" ? "The profile is still being drafted" : "The role has no profile to approve");
  return NextResponse.json({ role: await store.roles.update(id, { status: "approved" }) });
});
