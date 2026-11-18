# Beta workflow regression fixes

The Beta review branch starts from main at 09e830c. One product commit fixes co-instructor publication, unsaved HICC edits at submission, Teaching Assignments navigation for ADC, LAB and Developer, optional approval text, AFC rejection reason readback, Special Leave contract evidence, and ADFAD final note display.

Migration 070 updates the publication procedure and grants its existing runtime read role SELECT on the AFC rejection reason column. Apply migration 070 before activating the matching University API build. The SQL acceptance fixture checks that two instructors survive a single published session and that the existing runtime read principal can select the rejection reason. The Special Leave integration check covers a profile-only change and an actual FTE change. Previously approved deductions continue to use their recorded contract evidence.

The accompanying governance commit updates the static and API freeze to the product commit for review. Deployment and University SQL acceptance require their own release evidence.
