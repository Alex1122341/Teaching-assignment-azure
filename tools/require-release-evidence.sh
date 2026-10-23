#!/usr/bin/env bash
# Production release gate: requires Testing-deploy and/or UAT-approval evidence for COMMIT_SHA.
# Called by the Production release workflows when PAWS_REQUIRE_TESTING_PASS or PAWS_REQUIRE_RELEASE_APPROVAL
# is "true". Needs GH_TOKEN (actions:read), GITHUB_REPOSITORY, COMMIT_SHA; approvals also need
# PAWS_RELEASE_APPROVERS (comma-separated GitHub logins, an owner-managed repository variable).
set -euo pipefail
[[ "${COMMIT_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || { echo 'EVIDENCE_SHA: COMMIT_SHA must be a 40-character SHA'; exit 1; }
# Evidence tooling must itself come from main, or a branch could replace the checks.
[ "${GITHUB_REF:-}" = "refs/heads/main" ] || { echo "EVIDENCE_NOT_MAIN: release workflows must run from main (got ${GITHUB_REF:-unset})"; exit 1; }
kinds=()
[ "${REQUIRE_TESTING_PASS:-}" = "true" ] && kinds+=(testing)
[ "${REQUIRE_RELEASE_APPROVAL:-}" = "true" ] && kinds+=(testing approval)
[ "${#kinds[@]}" -gt 0 ] || { echo 'No release evidence required.'; exit 0; }
declare -A seen=()
for kind in "${kinds[@]}"; do
  [ -n "${seen[$kind]:-}" ] && continue; seen[$kind]=1
  found="$(node tools/verify-release-evidence.js find --kind "$kind" --sha "$COMMIT_SHA")"
  run_id="$(jq -r '.runId' <<< "$found")"; name="$(jq -r '.artifactName' <<< "$found")"; file="$(jq -r '.file' <<< "$found")"
  dir="$(mktemp -d)"
  gh run download "$run_id" --repo "$GITHUB_REPOSITORY" --name "$name" --dir "$dir"
  node tools/verify-release-evidence.js check --kind "$kind" --sha "$COMMIT_SHA" --run "$run_id" --file "$dir/$file"
  echo "RELEASE_EVIDENCE_OK: $kind run $run_id for $COMMIT_SHA"
done
