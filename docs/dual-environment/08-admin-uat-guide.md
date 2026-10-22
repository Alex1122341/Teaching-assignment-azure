> **2026-10-22 update — Azure retired.** Active University Testing operations are in [12-university-testing-operations.md](12-university-testing-operations.md). API: VET-C31293; online SQL: ITAPPVETOPSDB01 / VetMed-Ops-Testing; independent Firebase identity. Earlier Azure provisioning/reset/revision instructions below are historical and must not be executed. Code preparation is not live acceptance; SQL installation/isolation, Auth, actual API staging and final release remain pending.
# PAWS Testing: guide for ADFAD testers

The Testing environment is the same PAWS application with the same pages, buttons, filters and rules, connected to its own separate database of **made-up (synthetic) data**. Nothing you do in Testing reaches the real PAWS, and no email or message is sent to anyone.

You will always know you are in Testing: a red bar at the top of every page reads **TESTING ENVIRONMENT — SYNTHETIC DATA ONLY**.

## 1. Open Testing

- From real PAWS: if you are an ADFAD administrator, the top bar shows **Open Testing Environment**. It opens the same page in Testing.
- Or go straight to the Testing address the Owner gave you (`https://<testing site>.web.app`).

## 2. Sign in

Testing has **its own sign-in**, separate from real PAWS. Use the Testing account the Owner set up for you, and set its password with the reset link you received. Your real PAWS password does not work in Testing, and your Testing password does not work in real PAWS.

## 3. Use PAWS as normal

Every page is the same as in real PAWS: Timetable, Faculty Dashboard, Teaching Assignments, AFC, Calendar Activities, Change History, Tasks and User Management. You can view, add, edit, approve, import and export, exactly as you would for real, but only with the made-up data. Changes are saved and stay after you reload the page.

The made-up data includes, among other things:

- 31 faculty members with different ranks and appointments, including two inactive and one with no teaching.
- A full 2026-27 timetable, plus a few 2025-26 sessions.
- A double-booked faculty member (*Casey Mockford*, 24 Nov 2026, 10:00), so you can see conflict warnings.
- AFC requests in every state: waiting for the report-to, waiting for ADFAD, approved, rejected and withdrawn.
- A swap request waiting for a decision.
- Teaching Assignment packages: one in draft, one submitted for VISC review.
- Current, expired and future HICC/VISC roles.

## 4. See PAWS as someone else (Switch Test Identity)

To check what a Faculty member, HICC, VISC, ADC or LAB user sees:

1. Click **Switch Test Identity** in the red bar.
2. Choose a role and an account (for example *Casey Mockford · faculty*), type what you are testing, and click **Use this persona**.
3. The bar now shows **Testing as … — effective role …**. PAWS shows and allows only what that person could see and do.
4. Click **Return to myself** when finished. The session also ends by itself after 30 minutes; the bar then says **Test identity session expired**, and nothing more is saved until you return to yourself.

Good to know:

- You can only choose identities at or below your own level.
- Everything you do while switched is recorded under **your own name**, with the identity you used.
- Imports (Calendar Activities and CCC replacement uploads) can't be run while switched. Return to yourself to run them.
- Some newer actions can't be undone from the identity dialog (it shows **Reset to restore**). A Testing reset puts the data back.

## 5. Check a workflow

For each workflow you test, write down: the page, what you did, what you expected, what happened, and the time. A simple pattern:

1. Find the made-up record (for example the AFC request waiting for ADFAD approval).
2. Do the action (approve it).
3. Reload the page and check the change is still there.
4. Switch to the affected person (for example the faculty member) and check what they now see.

## 6. Report a problem

Send the Owner (or open a GitHub issue on the PAWS repository) with:

- the page address (copy it from the browser),
- the time,
- your Testing account and, if used, the test identity,
- steps to reproduce, expected result, and actual result,
- a screenshot of the page **including the red Testing bar**.

Testing contains only made-up data, so screenshots from Testing are safe to share. Never paste real PAWS data into a Testing record.

## 7. Go back to real PAWS

Click **Return to Production** in the red bar. Real PAWS opens and asks you to sign in with your real account. Nothing from Testing is carried over.

## 8. Ask for a fresh start (reset)

When the made-up data has drifted too far, ask the Owner for a **Testing reset**. A reset puts every made-up record back to its starting state, removes all changes made by every tester, and resets the Testing accounts. Only people on the Owner's reset list can run it, and each reset is recorded.

## 9. Finishing a round of testing

Tell the Owner whether the round **passed** or **failed** and where your notes are. The Owner records it in GitHub (**PAWS Release Approval**). A version can only be released to real PAWS after a passed round is recorded.
