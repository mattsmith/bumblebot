#!/usr/bin/env bash
# Asserts that ./install refuses to run when the `claude` CLI is missing.
#
# Bumblebot's install flow assumes the user has an active Claude Code
# subscription with the `claude` binary on PATH (see site/index.html and
# SPEC.md). If that precondition is not met, ./install must exit non-zero
# and point the user at https://claude.com/product/claude-code.
#
# Run with:  bash test/install-precondition.sh

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
install_script="${repo_root}/install"

if [[ ! -x "${install_script}" ]]; then
  echo "FAIL: ${install_script} is not executable" >&2
  exit 1
fi

# Sandbox PATH that excludes any real `claude` binary the host might have.
# /usr/bin + /bin keeps coreutils (bash, command, cat, etc.) but drops the
# user's local bin / nvm / homebrew dirs where `claude` typically lives.
sandbox_path="/usr/bin:/bin"

# Defensive sanity check: confirm `claude` really is absent in our sandbox.
if PATH="${sandbox_path}" command -v claude >/dev/null 2>&1; then
  echo "FAIL: test sandbox PATH still resolves 'claude' — cannot validate" >&2
  exit 1
fi

set +e
output="$(PATH="${sandbox_path}" "${install_script}" 2>&1)"
status=$?
set -e

if [[ ${status} -eq 0 ]]; then
  echo "FAIL: ./install exited 0 without claude on PATH (expected non-zero)" >&2
  echo "----- output -----" >&2
  echo "${output}" >&2
  exit 1
fi

if ! grep -q "claude.com/product/claude-code" <<<"${output}"; then
  echo "FAIL: error message missing https://claude.com/product/claude-code link" >&2
  echo "----- output -----" >&2
  echo "${output}" >&2
  exit 1
fi

if ! grep -qi "claude" <<<"${output}"; then
  echo "FAIL: error message did not mention claude CLI" >&2
  echo "----- output -----" >&2
  echo "${output}" >&2
  exit 1
fi

echo "PASS: ./install exits ${status} with claude-code link when CLI is missing"
