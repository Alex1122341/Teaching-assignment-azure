# Developer Support Workspace Implementation Plan

> Use superpowers:executing-plans inline. Owner delegates implementation decisions; no new/local tests. Preserve existing live release until CI and acceptance.

**Goal:** Real audited account delegation with guarded undo and a clearer app with cross-week tasks.
**Architecture:** SQL support contexts/change capture, request-local identity and transaction boundary; shared frontend support navigation and existing timetable task integration.
**Tech Stack:** Vanilla JS/CSS, Node AsyncLocalStorage, SQL Server, Firebase identity/Hosting.
**Spec:** ../specs/2026-10-09-developer-support-workspace-design.md

- [ ] SQL migration033: support context/operation/change audit, reviewed row capture and guarded undo; compile with rollback, no private audit exposure.
- [ ] API support service and SQL transaction/request-local adapter; real developer enforcement, existing target scope, expiry, error rollback, self return and safe public DTOs; CORS header.
- [ ] Shared developer panel, account/role lists, visible context, operation undo list; integrate all authenticated application pages.
- [ ] Timetable all-year task panel and session/event navigation; no dependency on current-week bottom tray; source-derived resolution and stable UI preferences.
- [ ] Shared visual system/navigation/filter/modal improvements; concept and rendered review using frontend skill.
- [ ] Inline review, syntax/build, immutable governance promotion, PR existing CI, exact-main merge CI, SQL/runtime/Hosting deploy, read-only acceptance and durable checkpoint.
