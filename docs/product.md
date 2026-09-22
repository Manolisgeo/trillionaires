# Product

Aperture is a realtime conversation intelligence platform. The long-term product is an AI participant that can join or host human conversations, speak and listen naturally, and turn every conversation into structured evidence.

The first wedge is AI-powered interviews. The product is not an interview tool with other use cases bolted on. It is a **Conversation** platform. Interviews are one conversation type.

## Who it is for

Teams that run high-stakes conversations and need more than a recording and a generic summary:

- recruiting and hiring
- sales discovery
- customer and user research
- expert interviews and due diligence
- education and internal meetings

## What it must feel like

The AI should feel like a competent human participant, not a form reader.

It listens continuously. It waits through thinking pauses. It does not interrupt unnecessarily, and it can barge in when the human starts speaking. It asks spontaneous follow-ups, remembers earlier statements, notices contradictions and vague answers, and changes strategy when the conversation already covered a planned topic. It can answer participant questions. After the call, it produces a structured report with evidence—not a blob of summary text.

Participants must always be able to tell the AI is AI. The product does not impersonate a human.

## Conversation types

Extensible. Built-ins:

| Type              | Typical purpose                                      |
| ----------------- | ---------------------------------------------------- |
| Interview         | Evaluate a person against a role and competencies    |
| Sales             | Discover pain, budget, process, and buying signals   |
| Research          | Test hypotheses and capture customer language        |
| Expert interview  | Investigate claims and map an area of expertise      |
| Meeting           | Decisions, owners, and follow-ups                    |
| Custom            | Any purpose expressed as objectives                  |

Templates (interview competencies, research hypotheses, sales discovery, expert topics) configure a conversation. They do not lock the agent into a script.

## Core user journey (MVP)

1. Sign in to an organization.
2. Create a conversation: type, title, purpose, objectives.
3. Disclose recording and AI participation; collect consent.
4. Join a native LiveKit room.
5. Speak with the AI participant. See live captions, timer, connection, recording.
6. End the call.
7. Watch processing status without a blocked UI.
8. Open a structured report, timeline, and searchable transcript.

## Scorecards and signals

The report is the narrative. The scorecard is the decision aid, and a person still decides.

Each objective becomes a rubric criterion with a strong anchor and a weak anchor. After the transcript exists, a draft attaches verbatim quotes and a suggested rating of 2, 3, or blank. A 4 is human-only. Reviewed ratings are not overwritten. Tracker phrases (metrics, incidents, commitments, compensation, competing options, decision process) are organization signals, not scores.

The setup used by Metaview, BrightHire, Gong, and Alex, and what Aperture implements in English, is in [benchmarks.md](./benchmarks.md).

## Report standard

A report is not “an AI summary.” It is a structured artifact:

- Executive summary (3–7 sentences)
- Key takeaways
- Important moments (timestamped, linked into transcript/recording)
- Decisions
- Action items (action, owner, due date when known)
- Questions raised
- Contradictions / inconsistencies with timestamps
- Evidence (claims + transcript excerpts)
- Topics discussed
- Detailed analysis against objectives
- Full searchable transcript

Every claim is labeled **FACT**, **INFERENCE**, or **UNCERTAINTY**. Inferences are never presented as established facts.

## Importance

Every transcript segment can be ranked and categorized (`KEY_FACT`, `DECISION`, `ACTION`, `INSIGHT`, `CONCERN`, `CONTRADICTION`, `QUESTION`, `BACKGROUND`, `LOW_VALUE`). The UI surfaces important content and lets people filter. Unimportant information is kept, not deleted.

## Human control

The AI never makes irreversible decisions.

- Hiring: evidence and assessment; a human decides.
- Sales: insights; a human owns the customer relationship.
- Research: patterns; a human interprets conclusions.

## Privacy

Conversation media is sensitive.

- Recording status is always visible.
- AI participation is disclosed.
- Consent is configurable and recorded.
- Retention is an organization control.
- Deletion is supported.
- There is no hidden recording mode.

## Navigation

Dashboard · Conversations · Reports · People · Templates · Search · Settings

Dashboard: recent and upcoming conversations, important insights, action items, basic stats.

## Design language

Minimal, premium, fast. Lots of whitespace, excellent typography, subtle motion. Information-dense when the work requires it (reports, transcripts). No decorative AI gradients, no gimmick graphics.

The call experience should feel like a modern video product (Meet/Zoom class), not a developer widget.

## Non-goals for v1

- Photoreal talking avatars (latency first; abstract AI presence is fine)
- Zoom / Google Meet / Teams join
- PSTN telephony
- Organization-wide semantic search at scale (conversation-level search ships first)
- Autonomous hiring or contracting decisions

## Success for the MVP

A person can create a conversation with a real objective, speak naturally with an AI participant that follows up intelligently, and receive a report they would actually use—grounded in transcript evidence, with contradictions and gaps called out.
