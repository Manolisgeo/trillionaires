import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RoomEntry from "@/components/room/RoomEntry";
import { loadRoomData } from "../_data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Interview room · Kimma", robots: { index: false } };

export default async function RoomPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadRoomData(id);
  if (!data) notFound();
  const flag = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const preview = flag("preview") === "1" || flag("preview") === "true";
  const boardOnly = flag("view") === "board";
  const mode = preview ? "preview" : boardOnly ? "board" : "live";
  const scene = flag("scene") === "board" ? "board" : flag("scene") === "browser" ? "browser" : "cv";
  return <RoomEntry data={data} mode={mode} scene={scene} boardOnly={boardOnly} />;
}
