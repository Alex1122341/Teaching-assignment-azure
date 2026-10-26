# PR144 release review — 2026-10-25

The owner requested PR139–144 reach merge/release standard, authorizing this review and subsequent controlled publication. The original retirement plan's draft/no-release checkpoint describes its initial authoring scope; this request authorizes integration after verification.

Base main: `c2c1de44d03262dc439dcffb9764b06ce7181cd1`; reviewed PR144 head: `2be6fdce00dfec6823b8e6a323c4eb68039e414c`.

Independent Standards review found a replaced historical authorization quotation. Restored the original quotation with an adjacent English translation. Independent Spec review found stale current ACA/ACR instructions and a Windows CRLF-sensitive governance test. Corrected current SETUP/AGENTS guidance, preserving frozen packaging and all source/artifact checks. Reproduced the Windows failure before restoring newline normalization.

The language inventory now examines tracked text regardless of extension, includes supplementary Han characters, counts binary skips, and fails visibly on unreadable tracked paths. Two public CLI tests first failed against the former inventory, then passed after the correction. The fixture uses its own disposable Git directory; it does not edit the application repository or access production.

Focused governance, packaging, retirement and inventory tests: 23 passed, 0 failed. Full exact-head CI remains required after this commit. Runtime, SQL, rules, frozen baselines and live gates are untouched. Remaining Chinese evidence paths, workbook sheet identifiers, source quotations and intentional Unicode fixtures are retained; this is an inventory, not an automatic translation gate.

Current PR139 code is already in main through PR140. PR143 is already published at c2c1de4. PR141/142 need current-main integration before a further frontend-only release; no University API or SQL redeployment is justified by these frontend changes.
