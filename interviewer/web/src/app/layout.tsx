import type { Metadata } from "next";
import { Courier_Prime, Public_Sans } from "next/font/google";
import "./globals.css";

const sans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-public-sans", display: "swap" });
const mono = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-courier-prime", display: "swap" });

export const metadata: Metadata = {
  title: "Kimma.ai",
  description: "An AI interviewer that points at the exact line it is asking about.",
};

const CONTRACT = `
Direction contract: The Reading Room (seed 0358a816)

THESIS: Kimma treats a candidate's background the way an archive treats a record: every claim catalogued with its provenance, every judgment cross-referenced to the moment it was said. It refuses the category default of an AI dashboard with a glowing orb.

OWN-WORLD: Hollinger blue-grey chrome #2F3B45, cool acid-free board #F4F5F2 (never cream), white catalog cards with a red top rule #C23B2E (red also and only = recording), violet stamp ink #5A4AA8 for everything the AI marks. Type: Public Sans, plus Courier Prime for call numbers and timecodes. Materials: stamps, slip markers, folder tabs, finding-aid outlines.

STORY: The candidate sees exactly what is being asked about and why. The recruiter sees every rating traced to a quote and a timecode. Both know a person decides.

FIRST VIEWPORT: The interview room. The question sits on a catalog card above the CV at page scale, with a violet slip on the line being asked about. The right column holds the AI stamp, the finding-aid phases and the typed transcript. The bottom bar's primary action is "I'm finished answering".

FORM: archival reading room and finding aid; #6 on the grounded list; seed key 0358a816.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="bg-board font-sans text-ink antialiased">
        <div hidden dangerouslySetInnerHTML={{ __html: `<!--${CONTRACT}-->` }} />
        {children}
      </body>
    </html>
  );
}
