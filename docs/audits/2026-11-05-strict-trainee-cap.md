# 2026–27 trainee reserve cap and worksheet

The Owner confirmed that Applied Trainee DOE is the smaller of Training Actual and Training Reserve. The 2026–27 worksheet now applies that rule for Faculty Lookup, DOE List, reports and SWAP previews. It uses the same displayed reserve and keeps recorded signed adjustments separate. Existing historical worksheet policies retain their original behavior. When required inputs are unavailable the worksheet continues to report Needs Review.

For the supplied Excel example, 17.50 actual and 7.50 reserve yield 7.50 applied. With 6.45 teaching DOE, the total is 13.95. The worksheet displays the workbook's item titles, source-confirmed trainee counts and credits, teaching reserve, and the teaching reserve plus unused trainee reserve when applicable.

Product commit `0bf28e9c09fde6f71f4b6b715337d2ad570a99c1` changes one protected static module and two protected API modules. Its separate promotion retains the entire static and API protection sets. The read-only University SQL candidate preview used the same source rows for old and new calculation. It found 27 changed applied values across active non-placeholder faculty, with 20 decreasing and 7 increasing. Exact personal results are retained in restricted reconciliation evidence.

The coordinated release requires the reviewed University API and Hosting builds, exact merge verification, Graphify regeneration and live post-release verification. The candidate preview did not alter SQL records or publish an annual policy.
