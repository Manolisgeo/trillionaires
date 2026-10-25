"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button, IconButton, Stamp } from "@/components/ui";
import { cx } from "@/components/ui/cx";

type Confirm = null | "human" | "leave";

interface Props {
  micEnabled: boolean;
  onToggleMic: () => void;
  onFinished: () => void;
  onRequestHuman: () => void;
  onLeave: () => void;
  captions: boolean;
  onToggleCaptions: () => void;
  humanRequested: boolean;
  leaving: boolean;
  /** Extra line shown at the end of the bar (preview label, save status). */
  note?: ReactNode;
}

/** Bottom bar. The primary action is "I'm finished answering". Risky actions confirm inline, not in a modal. */
export function RoomFooter({ micEnabled, onToggleMic, onFinished, onRequestHuman, onLeave, captions, onToggleCaptions, humanRequested, leaving, note }: Props) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [sent, setSent] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!sent) return;
    const t = window.setTimeout(() => setSent(false), 3500);
    return () => window.clearTimeout(t);
  }, [sent]);

  if (confirm) {
    const human = confirm === "human";
    return (
      <footer className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-rule bg-card px-4 py-3 sm:px-7 lg:static" onKeyDown={(e) => e.key === "Escape" && setConfirm(null)}>
        <div role="group" aria-label={human ? "Confirm request for a human interviewer" : "Confirm leaving the interview"} className="flex flex-wrap items-center gap-3">
          <p className="m-0 max-w-[62ch] text-[15px] leading-6">
            {human
              ? "Ask for a person to take over? Kimma will note your request and offer to end the call. A person at the company will see it."
              : "Leave the interview? The recording up to now is saved and sent. You can come back with the same link."}
          </p>
          <Button
            autoFocus
            size={48}
            variant={human ? "primary" : "danger"}
            onClick={() => {
              setConfirm(null);
              if (human) onRequestHuman();
              else onLeave();
            }}
          >
            {human ? "Send the request" : "Leave interview"}
          </Button>
          <Button size={48} variant="secondary" onClick={() => setConfirm(null)}>
            {human ? "Keep going" : "Stay"}
          </Button>
        </div>
      </footer>
    );
  }

  const secondary = (
    <>
      {humanRequested ? (
        <Stamp variant="neutral" rotate={-1.5} size="sm">
          Human requested
        </Stamp>
      ) : (
        <Button size={48} variant="secondary" onClick={() => setConfirm("human")}>
          Request a human interviewer
        </Button>
      )}
      <span role="status" className="font-mono text-[13px] text-stamp max-sm:hidden">
        {sent ? "Kimma knows you are finished." : ""}
      </span>
      <span className="flex-1 basis-6 max-sm:hidden" />
      {note}
      <span className="rounded-[3px] border border-dashed border-rule-strong px-2.5 py-1.5 font-mono text-[13px] text-muted">Extra think time: on</span>
      <Button
        size={48}
        variant="secondary"
        aria-pressed={captions}
        onClick={onToggleCaptions}
        className="aria-pressed:border-stamp! aria-pressed:bg-stamp-tint!"
      >
        Captions
      </Button>
      <Button size={48} variant="danger" busy={leaving} onClick={() => setConfirm("leave")}>
        Leave interview
      </Button>
    </>
  );

  return (
    // Phones: the bar sticks to the bottom with the primary action first; the rest opens under "More".
    <footer className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-rule bg-card px-4 py-3 sm:px-7 lg:static">
      <div className="flex w-full items-center gap-3 sm:contents">
        <IconButton
          aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
          onClick={onToggleMic}
          className={cx("order-2 sm:order-none", micEnabled ? undefined : "border border-ink bg-card! text-ink! hover:bg-board!")}
        >
          {micEnabled ? <Mic size={20} strokeWidth={1.75} aria-hidden="true" /> : <MicOff size={20} strokeWidth={1.75} aria-hidden="true" />}
        </IconButton>
        <span className="font-mono text-[13px] text-muted max-sm:hidden" aria-hidden="true">
          {micEnabled ? "Mic on" : "Mic off"}
        </span>
        <Button
          size={48}
          className="order-1 flex-1 sm:order-none sm:flex-none"
          onClick={() => {
            onFinished();
            setSent(true);
          }}
        >
          I&apos;m finished answering
        </Button>
        <Button
          size={48}
          variant="secondary"
          className="order-3 sm:hidden"
          aria-expanded={more}
          aria-controls="room-more-controls"
          onClick={() => setMore((m) => !m)}
        >
          {more ? "Less" : "More"}
        </Button>
      </div>
      <div id="room-more-controls" className={cx(more ? "flex w-full flex-wrap items-center gap-3" : "hidden", "sm:contents")}>
        {secondary}
      </div>
      {sent ? (
        <span role="status" className="w-full font-mono text-[13px] text-stamp sm:hidden">
          Kimma knows you are finished.
        </span>
      ) : null}
    </footer>
  );
}
