from state import MIN_DWELL_FOR_OBJECTIVES, InterviewState

PLAN = {"phases": [
    {"phase": "intro", "minutes": 1, "objectives": [], "questions": []},
    {"phase": "behavioral", "minutes": 2, "objectives": ["a", "b"],
     "questions": [{"id": "q1", "text": "x"}, {"id": "q2", "text": "y"}]},
    {"phase": "close", "minutes": 1, "objectives": ["z"], "questions": []},
]}


def mk():
    s = InterviewState.from_plan(PLAN)
    s.start(1000.0)
    return s


def test_deadline_advance():
    s = mk()
    assert not s.should_advance(1059.0)
    assert s.should_advance(1060.0)
    assert s.advance(1060.0)
    assert s.current.phase == "behavioral"
    assert s.deadline == 1060.0 + 120
    assert s.ends_at_ms() == int((1060.0 + 120) * 1000)


def test_objectives_advance_needs_all_and_dwell():
    s = mk()
    s.advance(1000.0)
    s.note_evidence("c1")
    assert not s.objectives_met()
    s.note_evidence("c2")
    assert s.objectives_met()
    assert not s.should_advance(1000.0 + MIN_DWELL_FOR_OBJECTIVES - 1)
    assert s.should_advance(1000.0 + MIN_DWELL_FOR_OBJECTIVES)


def test_evidence_counts_and_phase_scope():
    s = mk()
    s.advance(1000.0)
    s.note_evidence("c1"); s.note_evidence("c1")
    assert s.evidence_by_criterion == {"c1": 2}
    s.advance(1100.0)
    assert s.evidence_by_phase.get(s.index, 0) == 0


def test_last_phase_never_auto_advances():
    s = mk()
    s.advance(1000.0); s.advance(1000.0)
    assert s.is_last
    assert not s.should_advance(10_000.0)
    assert not s.advance(10_000.0)


def test_asked_questions_and_finished_flag():
    s = mk()
    s.advance(1000.0)
    s.mark_asked("q1")
    assert [q["id"] for q in s.unasked()] == ["q2"]
    assert s.find_question("q2")["text"] == "y"
    s.finished_answering = True
    assert s.consume_finished() and not s.finished_answering
    s.advance(1001.0)
    assert not s.finished_answering


def test_not_started_or_ended():
    s = InterviewState.from_plan(PLAN)
    assert not s.should_advance(10**9)
    s.start(0.0); s.ended = True
    assert not s.should_advance(10**9)


def test_empty_plan_fallback():
    s = InterviewState.from_plan({"phases": []})
    assert s.total == 2
