import json

from deskcache import DeskCache

PHASE = {"type": "phase", "phase": "background", "index": 2, "total": 5, "endsAt": 123}


def types(c: DeskCache) -> list[str]:
    return [m["type"] for m in c.messages()]


def test_empty_cache_replays_nothing():
    assert DeskCache().messages() == []


def test_keeps_latest_per_slot_in_replay_order():
    c = DeskCache()
    c.update({"type": "screen", "view": "cv"})
    c.update({"type": "question", "text": "old", "kind": "core"})
    c.update(PHASE)
    c.update({"type": "question", "text": "new", "kind": "probe"})
    msgs = c.messages()
    assert types(c) == ["phase", "question", "screen"]
    assert msgs[1]["text"] == "new"


def test_cv_highlight_then_clear_replays_only_clear():
    c = DeskCache()
    c.update({"type": "cv.highlight", "id": "q1", "quote": "x"})
    assert types(c) == ["cv.highlight"]
    c.update({"type": "cv.clear"})
    assert types(c) == ["cv.clear"]
    c.update({"type": "cv.highlight", "id": "q2", "quote": "y"})
    assert c.messages()[0]["id"] == "q2"


def test_browser_state_and_ignored_types():
    c = DeskCache()
    c.update({"type": "browser.session", "liveViewUrl": None})
    c.update({"type": "browser.navigated", "url": "https://github.com/x", "title": "x"})
    c.update({"type": "board.add", "shapes": []})
    c.update({"type": "ended", "reportUrl": None})
    assert types(c) == ["browser.session", "browser.navigated"]


def test_messages_are_copies_and_payloads_are_json():
    c = DeskCache()
    c.update(PHASE)
    c.messages()[0]["phase"] = "mutated"
    assert json.loads(c.payloads()[0])["phase"] == "background"
