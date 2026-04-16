#!/usr/bin/env bash
# RTK Copilot hook — rewrites bash commands to use rtk for token savings.
# Equivalent to the Claude Code hook but adapted to Copilot's preToolUse format.
#
# Input (stdin):  {"timestamp":...,"cwd":"...","toolName":"bash","toolArgs":"{\"command\":\"...\"}"}
# Output:         {"permissionDecision":"allow","modifiedArgs":{"command":"<rewritten>"}}
#
# Requires: rtk >= 0.23.0, jq

if ! command -v jq &>/dev/null || ! command -v rtk &>/dev/null; then
  exit 0
fi

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName // empty')

# Only intercept bash tool calls
if [ "$TOOL_NAME" != "bash" ]; then
  exit 0
fi

# toolArgs is a JSON string in Copilot hooks — parse it
CMD=$(echo "$INPUT" | jq -r '.toolArgs | fromjson | .command // empty' 2>/dev/null)

if [ -z "$CMD" ]; then
  exit 0
fi

REWRITTEN=$(rtk rewrite "$CMD" 2>/dev/null)
EXIT_CODE=$?

# Exit codes from rtk rewrite:
#   0 = rewrite found, auto-allow
#   1 = no RTK equivalent, pass through
#   2 = deny rule, pass through
#   3 = ask rule, rewrite but let Copilot prompt

if [ "$EXIT_CODE" -eq 1 ] || [ "$EXIT_CODE" -eq 2 ]; then
  exit 0
fi

if [ "$CMD" = "$REWRITTEN" ]; then
  exit 0
fi

# Return modified args with rewritten command
jq -cn --arg cmd "$REWRITTEN" '{"permissionDecision":"allow","modifiedArgs":{"command":$cmd}}'
