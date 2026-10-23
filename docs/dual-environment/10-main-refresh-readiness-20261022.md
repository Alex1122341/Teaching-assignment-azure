# PR125 latest-main readiness - 2026-10-22

## Source and review

Existing PR125, branch feat/paws-testing-environment, retains original head2994c73df92d1e692aa28094bb5c1ceec72403c8. Latest incorporated main: ad605dbb9ab92457df972703c723e2b991fa284c, including Availability PR124, restored History, CCC Schedule PR130 and Last, First faculty display PR131. Integrated product: 424242603af2d6ff313d6db3520e6d04ad5f9024; separate governance: 5abbb2ce3247c00f98f97212de35fa897bf62bb1. Independent Standards and Spec product reviews and governance review report READY with no actionable findings.

All latest naming surfaces remain present alongside environment navigation and configuration. Server runtime and package inputs are byte-identical to prior reviewed35a8416. Protected inventory86static/111APIruntime+3APIinputs; exact14static/7API delta from currentmain, no removed paths or drift exceptions. Original dual-environment, Availability, CCC, naming and35a integration receipts remain fixed historical tests. Canonical reporting hashes come from immutable product Git blobs, including the PDF.

## Corrective work

- Testing Hosting now stages the accepted bundle at the Firebase configuration's actual public path, .firebase-production/app.
- Exact GET Availability/CCC Schedule routes are permitted through Testing personas; domain own-faculty/role authorization, mutation denial and Production support restrictions are retained.
- Initial LocalDB acceptance refuses EVERY pre-existing VetMed-Ops instead of guessing ownership from markers. It creates only fresh local databases. Marked Testing reset remains independently guarded.
- Reset applies all forward migrations, including056/057, then six synthetic reader activities. Fixtures cover assigned/Locum CCC, next-year exclusion, rotation, cross-year ranges and missing clock evidence. Added HTTP/SQL acceptance checks cover pagination, own/cross access, public CCC fields and reset restoration.

## Current local evidence

Node22.20.0 with full Git history. Owner authorizes local verification while GitHub Actions quota is exhausted; no GitHub CI pass or CI artifact is claimed.

| Check | Result |
|---|---|
| Latest root npm test | 1093total: 1041pass,0fail,52skip |
| Complete server, files scheduled serially | 860total: 856pass,0fail,4skip |
| Latest name/config/tooling/role regression |88pass,0fail |
| Current/historical integrated governance |6pass,0fail |
| Parser files scheduled serially |41pass,0fail |
| Prior corrective regressions / merged UI |45/45 and82/82 |
| Latest combined build |PASS:86static/111API runtime |
| Repository and built-artifact freezes |PASS: current anchor, zero drift |
| Testing build --if-provisioned |Explicit TESTING_NOT_PROVISIONED skip |
| New LocalDB reader HTTP/SQL acceptance |NOT RUN: LocalDB unavailable here |
| Deployed Testing scenarios A-H |NOT RUN: Testing resources unconfigured |

The full server command is node --test --test-concurrency=1 test/*.test.js from server. Two default-concurrency runs each returned852pass/4fail/4skip because PDF/Excel workers hit the existing5/10-second limits; one had no simultaneous governance process. Serial scheduling passes all the same tests with unchanged production limits. This is a host/default-concurrency limitation, not evidence that default-concurrency CI is green. Root emulator-dependent skips remain; this update changes no Firestore rules.

## Historical evidence

The earlier35a integration passed fullroot1032/0fail/52skip and server856/0fail/4skip. Initial reporting-hash failures were reproduced and corrected only in non-authoritative reporting JSON (637203c); tests and PDF/runtime bytes were unchanged. The historical LocalDB44/44 receipt applies to the earlier product and is not reused for current readers. Earlier readiness details remain in09-deployment-readiness-report.md.

## Readiness and remaining work

Current source reconciliation, independent review, local suites, build and frozen artifact checks are complete. Deployment readiness is not established: committed Testing Firebase config, Hosting site and API origin remain null. No resources or credentials were invented or provisioned.

Before a deployment from this branch, configure and verify explicit PAWS_ENVIRONMENT=production on the Production API, as in03-setup-and-deployment.md; provision isolated Testing resources; run fresh disposable SQL acceptance and deployed A-H UAT. Filling Testing configuration/Production peer URL changes frozen configuration and needs its own reviewed promotion. No production SQL/config/data writes, migration replay, main merge or deployment were performed here.

For disposable LocalDB acceptance, use Node22/server dependencies/SqlLocalDB.exe and two previously unused instance names via PAWS_LOCAL_ACCEPTANCE_TESTING_INSTANCE and PAWS_LOCAL_ACCEPTANCE_PRODUCTION_INSTANCE; then run node tools/testing-db/local-acceptance.js. Both instances are synthetic local databases. Keep .azure-testing/local-acceptance.json as fresh evidence. Do not reuse a marked existing database or aim the helper/test-only token verifier at a live deployment.
