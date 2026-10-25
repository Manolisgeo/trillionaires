#!/usr/bin/env bash
# Interactive wizard: collects API keys and writes interviewer/.env. Secrets are never echoed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

declare -a KEYS=()
declare -a VALS=()
set_val() { KEYS+=("$1"); VALS+=("$2"); }

ask() { # name, prompt, default
  local v; read -r -p "  $2 [${3:-}]: " v; set_val "$1" "${v:-$3}"
}
ask_secret() { # name, prompt  (Enter = skip)
  local v; read -r -s -p "  $2 (Enter to skip): " v; echo
  set_val "$1" "$v"
}

echo "Aperture key setup. Writes $ENV_FILE"
echo "Press Enter to skip any key; features degrade gracefully without them."
echo

if [[ -f "$ENV_FILE" ]]; then
  bak="$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$ENV_FILE" "$bak"; chmod 600 "$bak"
  echo "Existing .env backed up to $bak"; echo
fi

echo "1. App"
ask PUBLIC_BASE_URL "Public base URL (use an https tunnel for Google Meet)" "http://localhost:3000"
set_val AGENT_INTERNAL_SECRET "$(openssl rand -hex 32)"
echo "  AGENT_INTERNAL_SECRET generated."; echo

echo "2. LiveKit (https://cloud.livekit.io -> project -> Settings -> Keys; or leave defaults for local 'docker compose up')"
ask LIVEKIT_URL "LiveKit URL" "ws://localhost:7880"
ask LIVEKIT_API_KEY "LiveKit API key" "devkey"
read -r -s -p "  LiveKit API secret [secret] (Enter for default): " v; echo; set_val LIVEKIT_API_SECRET "${v:-secret}"
ask LIVEKIT_AGENT_NAME "Agent name" "aperture-interviewer"; echo

echo "3. Anthropic (https://console.anthropic.com -> API keys): prep + scoring"
ask_secret ANTHROPIC_API_KEY "Anthropic API key"; echo

echo "4. OpenAI (https://platform.openai.com/api-keys): interviewer LLM / realtime / TTS fallback"
ask_secret OPENAI_API_KEY "OpenAI API key"; echo

echo "5. Deepgram (https://deepgram.com -> Console -> API keys): speech-to-text"
ask_secret DEEPGRAM_API_KEY "Deepgram API key"; echo

echo "6. Cartesia (https://cartesia.ai -> Playground -> API keys; pick a voice and copy its ID): text-to-speech"
ask_secret CARTESIA_API_KEY "Cartesia API key"
ask CARTESIA_VOICE_ID "Cartesia voice ID" ""; echo

echo "7. Browserbase (https://browserbase.com -> Settings): cloud browser the agent shows on screen"
ask_secret BROWSERBASE_API_KEY "Browserbase API key"
ask BROWSERBASE_PROJECT_ID "Browserbase project ID" ""; echo

echo "8. Exa (https://exa.ai -> dashboard -> API keys): candidate web research"
ask_secret EXA_API_KEY "Exa API key"; echo

echo "9. Recall.ai (https://recall.ai -> dashboard): Google Meet bot"
ask_secret RECALL_API_KEY "Recall API key"
ask RECALL_REGION "Recall region" "us-west-2"; echo

echo "10. Optional: GitHub token (raises rate limit), demo mode"
ask_secret GITHUB_TOKEN "GitHub token"
ask DEMO_SHORT_INTERVIEW "Short demo interview (1=yes, 0=no)" "0"; echo

# Defaults for keys not prompted: take them from .env.example.
get() { # lookup collected value
  local i; for i in "${!KEYS[@]}"; do [[ "${KEYS[$i]}" == "$1" ]] && { printf '%s' "${VALS[$i]}"; return; }; done
}
tmp="$(mktemp)"; umask 077
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" =~ ^([A-Z0-9_]+)=(.*)$ ]]; then
    k="${BASH_REMATCH[1]}"; d="${BASH_REMATCH[2]}"
    found=0; for kk in "${KEYS[@]}"; do [[ "$kk" == "$k" ]] && found=1; done
    if [[ $found -eq 1 ]]; then printf '%s=%s\n' "$k" "$(get "$k")" >> "$tmp"; else printf '%s=%s\n' "$k" "$d" >> "$tmp"; fi
  else
    printf '%s\n' "$line" >> "$tmp"
  fi
done < "$ROOT/.env.example"
mv "$tmp" "$ENV_FILE"; chmod 600 "$ENV_FILE"

echo "Wrote $ENV_FILE (keys not shown)."
echo "Next: docker compose up -d livekit; pnpm --dir web dev; (cd agent && uv run python src/main.py dev)"
