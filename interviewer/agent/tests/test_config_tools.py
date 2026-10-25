from config import load_settings, missing_keys
from tools import host_allowed, link_domains


def test_missing_keys_cascade_default():
    s = load_settings({"AGENT_INTERNAL_SECRET": "x"})
    assert missing_keys(s) == ["CARTESIA_API_KEY", "DEEPGRAM_API_KEY", "OPENAI_API_KEY"]


def test_missing_keys_anthropic_eleven_and_ok():
    env = {"INTERVIEWER_LLM": "anthropic:claude-haiku-5-5", "TTS_PROVIDER": "elevenlabs", "AGENT_INTERNAL_SECRET": "x"}
    assert missing_keys(load_settings(env)) == ["ANTHROPIC_API_KEY", "DEEPGRAM_API_KEY", "ELEVENLABS_API_KEY"]
    env.update(ANTHROPIC_API_KEY="a", DEEPGRAM_API_KEY="d", ELEVENLABS_API_KEY="e")
    assert missing_keys(load_settings(env)) == []


def test_missing_keys_realtime_and_secret():
    s = load_settings({"VOICE_MODE": "openai_realtime"})
    assert missing_keys(s) == ["OPENAI_API_KEY", "AGENT_INTERNAL_SECRET"]


def test_allowlist():
    dom = link_domains({"links": ["https://www.jane.dev/about", "linkedin.com/in/jane"]})
    assert dom == {"jane.dev", "linkedin.com"}
    assert host_allowed("https://github.com/jane/repo", dom)
    assert host_allowed("https://gist.github.com/x", dom)
    assert host_allowed("https://blog.jane.dev/p", dom)
    assert not host_allowed("https://evil.com/github.com", dom)
    assert not host_allowed("https://notgithub.com", dom)
    assert not host_allowed("javascript:alert(1)", dom)
