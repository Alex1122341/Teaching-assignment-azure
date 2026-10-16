# Agent Update — Faculty reference UI release and DOE SQL hotfix

**Date:** 2026-10-09  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL — first release deployed; follow-up hotfix pending

## Goal / authorization

Continue the owner's approved reference Faculty Lookup/Edit and DOE Rule Book work; owner explicitly authorized publication. Preserve negotiated signed manual DOE and formal source data.

## Starting breakpoint and completed release

PR77 merged as c5f7106cc429b4f082682f004e1545dad834fc29; exact-main CI37944509892 succeeded. Firebase Hosting-only deployment completed with62 files. University API source-attested release c5f7106, trust0f9ce1c4c9a748283cffc76394f22247a9f17451, PID20056, loopback18787. Public runtime/SQL health succeeded. Existing DOE admin/publish/recalculate gates and three operation-role memberships enabled for the configured principal; all other gates preserved. No new migration, source import, policy activation or recalculation performed.

## Live finding / repair

Read-only inspection showed original2026-27 normalized Draft A607A73D-ED99-40E4-A9D3-81DDF6D1E327 still has6 rules. Newly created clone327C6669-C49B-4B7C-9238-B3D25A59CDAD has0 rules, revision0, only draft_created audit. SQL NOEXEC diagnostic reported2717: nvarchar(8000) exceeds4000. Server C drive has0 free bytes; database data/log files are on S/L with free space, so do not attribute SQL compile error to disk fullness.

Product902a6cc6a876e24badf12df1deb7853fc0cc2993 replaces six invalid DOE SQL declarations with nvarchar(max), performs clone creation/contents/audits in one saveDraft transaction, repairs publication checksum query's missing FROM, and synchronizes loaded Policy Version selection. Independent review accepted. No new/local tests; syntax/build and read-only SQL NOEXEC compile inspected. Existing baseline fixture anchors synchronized only. Separate immutable freeze promotion points to accepted902a6cc;62 static/60 API runtime/63 API protected paths, no exceptions.

## Current breakpoint

Branch fix/doe-sql-draft-clone-20261009. Follow-up governance review, PR+CI, merge/exact-main CI, versioned API replacement and Hosting-only release pending. C has no space; use scoped P:\PAWS\Runtime staging/version roots for new files and existing node_modules junction. Preserve current c5 launcher rollback. Do not delete or silently populate the owner's failed cloned Draft; record its provenance/state. Original6-rule Draft remains reviewable.

## DO NOT REDO

Do not rerun source imports, fill deferred targets, activate an annual policy, recalculate allocations, rotate credentials, or repeat the initial PR77 release. Do not expose DPAPI/configured secrets.
