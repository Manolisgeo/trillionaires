"""Interview progress state. Pure Python (no livekit) so it is testable offline.

Plan dicts mirror web/src/lib/types.ts `Plan` (camelCase JSON).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Objective-based advance only after this many seconds in a phase, so the agent
# does not skip a phase the instant a note lands.
MIN_DWELL_FOR_OBJECTIVES = 20.0


@dataclass
class PhaseState:
    phase: str
    minutes: float
    objectives: list[str]
    questions: list[dict[str, Any]]
    problem_id: str | None = None


@dataclass
class InterviewState:
    phases: list[PhaseState]
    index: int = 0
    started: bool = False
    phase_started_at: float = 0.0
    deadline: float | None = None  # epoch seconds
    asked: set[str] = field(default_factory=set)
    evidence_by_criterion: dict[str, int] = field(default_factory=dict)
    evidence_by_phase: dict[int, int] = field(default_factory=dict)
    finished_answering: bool = False
    ended: bool = False

    @classmethod
    def from_plan(cls, plan: dict[str, Any]) -> "InterviewState":
        phases = [
            PhaseState(
                phase=p["phase"],
                minutes=float(p.get("minutes", 1)),
                objectives=list(p.get("objectives") or []),
                questions=list(p.get("questions") or []),
                problem_id=p.get("problemId"),
            )
            for p in (plan.get("phases") or [])
        ]
        if not phases:
            phases = [PhaseState("intro", 2, [], []), PhaseState("close", 2, [], [])]
        return cls(phases=phases)

    # --- phase navigation -------------------------------------------------
    @property
    def current(self) -> PhaseState:
        return self.phases[self.index]

    @property
    def total(self) -> int:
        return len(self.phases)

    @property
    def is_last(self) -> bool:
        return self.index >= self.total - 1

    def start(self, now: float) -> None:
        self.started = True
        self._enter(now)

    def _enter(self, now: float) -> None:
        self.phase_started_at = now
        self.deadline = now + self.current.minutes * 60.0

    def ends_at_ms(self) -> int | None:
        return int(self.deadline * 1000) if self.deadline else None

    # --- progress ---------------------------------------------------------
    def mark_asked(self, question_id: str | None) -> None:
        if question_id:
            self.asked.add(question_id)

    def unasked(self) -> list[dict[str, Any]]:
        return [q for q in self.current.questions if q.get("id") not in self.asked]

    def find_question(self, question_id: str | None) -> dict[str, Any] | None:
        if not question_id:
            return None
        for ph in self.phases:
            for q in ph.questions:
                if q.get("id") == question_id:
                    return q
        return None

    def note_evidence(self, criterion_id: str | None) -> None:
        if criterion_id:
            self.evidence_by_criterion[criterion_id] = self.evidence_by_criterion.get(criterion_id, 0) + 1
        self.evidence_by_phase[self.index] = self.evidence_by_phase.get(self.index, 0) + 1

    def objectives_met(self) -> bool:
        """All objectives of the current phase have at least one evidence note each."""
        n = len(self.current.objectives)
        return n > 0 and self.evidence_by_phase.get(self.index, 0) >= n

    def should_advance(self, now: float) -> bool:
        if self.ended or not self.started or self.is_last:
            return False
        if self.deadline is not None and now >= self.deadline:
            return True
        return self.objectives_met() and (now - self.phase_started_at) >= MIN_DWELL_FOR_OBJECTIVES

    def advance(self, now: float) -> bool:
        """Move to the next phase. Returns False if already on the last one."""
        if self.is_last:
            return False
        self.index += 1
        self.finished_answering = False
        self._enter(now)
        return True

    def consume_finished(self) -> bool:
        was, self.finished_answering = self.finished_answering, False
        return was

    def time_left(self, now: float) -> float | None:
        return None if self.deadline is None else max(0.0, self.deadline - now)
