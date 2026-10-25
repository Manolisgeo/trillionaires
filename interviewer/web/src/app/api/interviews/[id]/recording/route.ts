import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { DATA_DIR, store } from "@/lib/store";
import { type Ctx, filesUrl, HttpError, route } from "../../../_lib/http";

const MAX_BYTES = 500 * 1024 * 1024;

/** multipart: `audio` (webm blob); optional `recordingStartedAt` (epoch ms or ISO) or `offsetSec`. */
export const POST = route(async (req, { params }: Ctx) => {
  const { id } = await params;
  const iv = await store.interviews.get(id);
  if (!iv) throw new HttpError(404, "Interview not found");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Expected multipart/form-data");
  }
  const f = form.get("audio") ?? form.get("file");
  if (!(f instanceof File) || f.size === 0) throw new HttpError(400, "audio file is required");
  if (f.size > MAX_BYTES) throw new HttpError(413, "Recording is too large");
  await fs.mkdir(path.join(DATA_DIR, "recordings"), { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, "recordings", `${id}.webm`), Buffer.from(await f.arrayBuffer()));

  let offsetSec = 0;
  const explicit = Number(form.get("offsetSec"));
  const startedRaw = form.get("recordingStartedAt");
  if (form.get("offsetSec") !== null && Number.isFinite(explicit)) offsetSec = explicit;
  else if (typeof startedRaw === "string" && iv.startedAt) {
    const t = /^\d+$/.test(startedRaw) ? Number(startedRaw) : Date.parse(startedRaw);
    if (Number.isFinite(t)) offsetSec = (t - Date.parse(iv.startedAt)) / 1000;
  }
  const recording = { url: filesUrl(`recordings/${id}.webm`), offsetSec };
  await store.interviews.update(id, { recording });
  return NextResponse.json({ recording });
});
