import { ExternalLink, Globe } from "lucide-react";
import { EmptyState, Stamp } from "@/components/ui";
import type { DeskState } from "./deskState";
import { hostOf } from "./deskState";

/** Kimma's own browser, view only. Live view iframe when Browserbase gave one; otherwise a link card. */
export function BrowserView({ browser }: { browser: DeskState["browser"] }) {
  const { url, title, liveViewUrl } = browser;
  if (!url && !liveViewUrl) {
    return (
      <div className="p-6">
        <EmptyState title="Kimma has not opened a page yet">
          When it asks about a repository or a site you shared, that page opens here. You watch; you do not need to click anything.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-rule bg-board px-4 py-2">
        <Globe size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-ink-2" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink" aria-label="Address Kimma is viewing" title={url ?? undefined}>
          {url ?? "Loading"}
        </span>
        <Stamp variant="dashed" className="shrink-0">
          View only
        </Stamp>
      </div>
      {liveViewUrl ? (
        <iframe
          src={liveViewUrl}
          title={title ? `Kimma's browser, view only: ${title}` : "Kimma's browser, view only"}
          sandbox="allow-same-origin allow-scripts"
          referrerPolicy="no-referrer"
          tabIndex={-1}
          className="pointer-events-none min-h-0 w-full flex-1 border-0 bg-white"
        />
      ) : (
        <div className="p-6">
          <div className="flex max-w-[62ch] flex-col items-start gap-2 border border-dashed border-rule-strong bg-card px-6 py-6">
            <h2 className="m-0 text-base font-bold">{title || (url ? hostOf(url) : "Page")}</h2>
            <p className="m-0 text-sm leading-[22px] text-ink-2">
              Kimma opened this page to ask you about it. A live view is not available in this environment, so open it yourself to follow along.
            </p>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
                Open {hostOf(url)} <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
