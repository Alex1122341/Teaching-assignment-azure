# PR125 current-main refresh — 2026-10-22

## Source and review

- Existing PR125 and branch `feat/paws-testing-environment`; original head `2994c73df92d1e692aa28094bb5c1ceec72403c8` preserved in history.
- Fetched main `924cc6761a3b2dfba4f19c2df912436cbd965b43` is an ancestor of integrated product `35a84164d4a330e6f6d0427b4850a7836445832f`.
- Main includes merged Availability PR124, History restoration and read-only CCC Schedule PR130. All remain present; their reader implementations and SQL056/057 are unchanged.
- Independent Standards and Spec product reviews: no remaining actionable finding. Separate governance review `a30ad39927fbc9f36cb8f4ec616035fb8361d2ae`: READY, no actionable finding.
- One shared reviewed product anchor;86 static and111 API runtime files, plus3 API build/package inputs. No removed protection or drift exceptions. Original dual-environment, CCC and earlier governance receipts remain pinned historically.

## Corrective changes

1. Hosting stages the accepted Testing bundle at `.firebase-production/app`, matching `firebase.hosting-only.json`.
2. Testing personas can GET Availability and CCC Schedule. Real API/SQL authorization still checks their role and own-faculty scope; mutations remain denied. Production Developer Support's route restrictions are unchanged.
3. Initial LocalDB acceptance refuses every existing VetMed-Ops, regardless of markers. It creates only fresh databases; it no longer guesses ownership and drops an existing database.
4. Guarded reset applies all forward migrations including056/057, then loads six synthetic reader activities. Coverage and HTTP/SQL acceptance check assigned/Locum CCC, next-year exclusion, complete work pagination, cross-year dates, missing clocks, own/cross authorization and reset restoration.

## Fresh local evidence

Node22.20.0, full local Git history. No Actions dispatched or GitHub CI pass claimed; owner has authorized local checks while Actions quota is exhausted.

| Check | Result |
|---|---|
| Original focused environment/tooling/readiness baseline |54pass,0fail |
| Merged main UI/lifecycle/CCC regressions |82pass,0fail |
| Corrective Hosting/persona/database tooling |45pass,0fail |
| Full server `npm test --prefix server` |860total:856pass,0fail,4skip |
| Initial full root `npm test` |1084total:1030pass,2fail,52skip; both failures traced to one non-authoritative PDF reporting hash; corrected in637203c, focused reproduction now2/2pass. Full rerun in progress |
| Repository static freeze |PASS,86 protected |
| Repository API freeze |PASS,111 runtime +3 inputs |
| Production candidate build |PASS,86 static /111 API runtime; local build, not a CI artifact |
| Built static/API artifact freezes |PASS,86 static /111 API runtime,0 drift |
| Testing build `--if-provisioned` |Expected explicit skip: `TESTING_NOT_PROVISIONED` |
| New LocalDB HTTP/SQL reader acceptance |Not executed: LocalDB is not installed in this local environment. Historical44/44 is not reused |
| Live Testing UAT |Not executed; Testing resources are unconfigured |

Root tests normally skip emulator-dependent tests without running emulators. This refresh changes no Firestore rules. No new SQL execution, live authentication or deployed acceptance is implied by unit tests or source review.

## Readiness and remaining work

Source reconciliation and independent code/governance review are complete. Full root and built-artifact verification are still in progress. Testing Firebase config, Hosting site and API origin are null in the committed config, so the build deliberately refuses a deployable Testing artifact. No cloud resources, identities or credentials were invented or provisioned.

Before a deployment from this branch: set the Production API's explicit `PAWS_ENVIRONMENT=production` as described in `03-setup-and-deployment.md`; verify existing Production environment compatibility; provision the isolated Testing resources; execute the fresh disposable SQL acceptance and deployed scenarios A–H. Filling the Testing config/Production peer URL changes frozen runtime configuration and requires its own reviewed promotion. These are deployment prerequisites, not completed actions in this PR update.

No production data/configuration changes, migration replay, reset of an existing database, main merge or deployment were performed.

### Fresh disposable SQL acceptance when LocalDB is available

Use Node22 with installed server dependencies and `SqlLocalDB.exe` on PATH. Choose two previously unused instance names; the helper refuses an existing VetMed-Ops even if it carries a Testing marker. For example, in PowerShell:

```powershell
$env:PAWS_LOCAL_ACCEPTANCE_TESTING_INSTANCE = 'PAWSTest125_20261022'
$env:PAWS_LOCAL_ACCEPTANCE_PRODUCTION_INSTANCE = 'PAWSProd125_20261022'
node tools/testing-db/local-acceptance.js
```

Both are synthetic local instances; the second is only a Production stand-in. Keep the resulting `.azure-testing/local-acceptance.json` as fresh evidence. Never point this helper or its test-only token verifier at a live deployment, and never rename an existing database to make a failed acceptance run look fresh.
