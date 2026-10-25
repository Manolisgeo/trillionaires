# How the category leaders are set up

Kimma.ai is judged against four products companies already pay for. This note records what each one actually does, how it is configured, and what Kimma.ai implements in English. Integrations that would be fake — ATS write-back, Zoom, telephony — are listed as not built.

Language policy: the participant, the transcript search, the scorecard, and the trackers are English. Metaview advertises 50+ languages. Matching that without a speech provider tuned per language would be a worse product, not a broader one.

## Metaview — interview evidence

What they sell: a notetaker that drafts a scorecard from the interview, with each competency pinned to the candidate’s words and a timestamp. Humans review and submit. The rating and the quote stay together so a debrief argues about the recording, not memory.

How it is set up:

1. The role starts from a rubric. Competencies are defined before the interview, with what a strong and weak answer look like.
2. The notetaker transcribes verbatim.
3. Each answer is tagged to the competency it addresses.
4. The scorecard arrives pre-filled. The interviewer assigns the rating. The quote stays attached.
5. The same scale is used across interviewers so a debrief can see disagreement.

Kimma.ai setup:

- Creating a conversation writes one rubric criterion per objective, with a strong anchor and a weak anchor.
- After analysis, `draftScorecard` attaches supporting quotes and any conflicting quotes, and labels confidence (`DIRECT`, `REPEATED`, `CONTRADICTED`, `UNKNOWN`). It does not assign a 1–4 score. A person does.
- A contradicted moment is labeled UNCERTAINTY and capped at 2.
- A reviewer presses 1–4. That rating is marked reviewed and is not overwritten by a later draft.
- The scorecard lives on the conversation, next to the transcript. Clicking a quote seeks that moment.

## BrightHire — highlights and one-click feedback

What they sell: interviewers stay in the conversation. Afterwards they get notes mapped to the guide, clips of the moments that mattered, and a scorecard they can submit without retyping. Consent, retention, and deletion are part of the product because the recording is a hiring record.

How it is set up:

1. An interview guide defines the questions and the rubric before the call.
2. Interviewers can flag a moment during the call. The flag points at the recording.
3. After the call, notes and clips are grouped by competency.
4. A hiring manager can watch the clip instead of the hour.
5. Feedback is submitted by a person. The tool does not hire.

Kimma.ai setup:

- The guide is the template: purpose, objectives, and planned questions. The agent may skip a question the participant already answered.
- Important moments, tracker hits, and scorecard quotes are the clips. They seek the transcript. There is no separate video product until a recording exists.
- Consent is required before a recorded room starts. Retention is an organization setting, and deletion is explicit.
- Export writes the transcript and the report. Print is the debrief packet.

## Gong — trackers and talk patterns

What they sell: every customer conversation becomes searchable. Keyword trackers find phrases. Smart trackers find a concept even when the words differ. Managers look at talk ratio, topics, and which calls contain a tracker, then coach from the recording.

How trackers are set up:

1. A tracker belongs to a workspace.
2. You choose which side of the conversation to listen to, and the phrases or the question that defines the concept.
3. Hits show up on the call, in search, and in team stats.
4. A hit is not a score. It is a place to listen.

Kimma.ai setup:

- Built-in English trackers: Metrics, Incidents, Commitments, Compensation, Competing option, Decision process. Phrases are stored on the tracker and matched case-insensitively inside the organization.
- Owners and admins add a tracker from Signals with a name and comma-separated phrases.
- Hits are recomputed when analysis finishes, and the demo conversation is indexed on seed.
- Talk time, turn count, and question count sit beside the scorecard. They describe the conversation. They are not a quality score.

Smart trackers that understand a concept without the words require an embedding over every segment. Keyword trackers ship now because they are inspectable. Semantic search across conversations already exists when an embedding key is configured.

## Alex (Apriora) — the live interviewer

What they sell: an AI interviewer on a live call. A guide sets the introduction, the questions, a small number of follow-ups, and grading criteria with weights and written instructions for what strong and weak sound like. After the call, a report scores skills and summarizes each question. Ask Alex answers from the interview. The product is explicit that the assistant does not shortlist or reject.

How a guide is set up:

1. Questions, with at most a couple of follow-ups so the call stays structured.
2. Each criterion names what is being measured and how to judge it.
3. Weights change how much a criterion carries. Default is equal.
4. The report explains the score. A human still decides.

Kimma.ai setup:

- The agent speaks English, says it is an AI, and asks one question at a time.
- Follow-ups come from conversation state: vague answers, contradictions, and uncovered objectives. It does not walk the question list if the topic was already covered.
- Grading criteria are the rubric above. Weights come from the objective importance.
- Ask this transcript returns quotes from that conversation only. If nothing matches, it says the transcript does not answer. It does not invent a claim.

## What is intentionally not copied

- ATS write-back to Greenhouse, Ashby, Lever, or Workday. There is no ATS connected, so there is no “one-click submit.”
- Joining Zoom, Meet, or Teams, and dialing a phone number.
- Covert proctoring: tab switches, clipboard monitoring, or hidden recording. The AI is disclosed. Recording status is visible.
- A model-assigned hire / no-hire, or an automatic 4.
- Multilingual speech. English is the product until a speech provider is configured per language.

## Where it lives

| Piece | Code |
| --- | --- |
| Draft rating, talk time, tracker match, grounded ask | `packages/conversation/src/scorecard.ts` |
| Persist draft and hits after analysis | `apps/web/src/server/evidence.ts` |
| Human rating and custom trackers | `apps/web/src/actions/scorecard.ts` |
| Scorecard and ask UI | `apps/web/src/components/conversation/scorecard-panel.tsx` |
| Tracker library | `/signals` |
| English participant instructions | `apps/agent/src/instructions.py` |
