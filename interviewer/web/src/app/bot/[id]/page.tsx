import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BotBridge from "@/components/room/Bot";
import { loadRoomData } from "../../room/_data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kimma.ai · meeting bridge", robots: { index: false } };

/** Fixed 1280x720: this page is the Recall bot's camera, not something a person navigates. */
export default async function BotPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadRoomData(id);
  if (!data) notFound();
  return <BotBridge data={data} preview={sp.preview === "1"} />;
}
