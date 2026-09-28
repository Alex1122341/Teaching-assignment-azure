import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


class BetaR1SqlRuntimeContractTests(unittest.TestCase):
    def test_api_permission_script_is_read_only_and_column_scoped(self):
        sql = (ROOT / "database" / "azure-sql" / "004_swa_beta_permissions.sql").read_text(encoding="utf-8")
        # The runtime principal is bound at apply time; the deployed Beta runtime
        # connects as the application managed identity, not a `paws_swa_beta`
        # contained user, so the script must address a parameter.
        self.assertIn("$(PAWS_API_PRINCIPAL)", sql)
        self.assertIn("paws.UserProfile", sql)
        self.assertIn("MustChangePassword", sql)
        self.assertIn("paws.vCalendarSession", sql)
        self.assertIn("paws.SessionAssignment", sql)
        self.assertRegex(sql, r"DENY INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::paws")
        self.assertRegex(sql, r"DENY SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::staging")
        self.assertNotRegex(sql, r"GRANT\s+(?:INSERT|UPDATE|DELETE|CONTROL|ALTER)", re.I)
        self.assertNotRegex(sql, r"GRANT\s+SELECT\s+ON\s+SCHEMA::paws", re.I)

    def test_session_repository_reads_the_canonical_calendar_view(self):
        source = (ROOT / "server" / "src" / "data" / "sql-session-repository.js").read_text(encoding="utf-8")
        self.assertIn("paws.vCalendarSession", source)
        self.assertNotIn("staging.", source)
        self.assertNotRegex(source, r"\b(?:INSERT|UPDATE|DELETE)\b", re.I)

    def test_dashboard_repository_is_read_only_and_sql_only(self):
        source = (ROOT / "server" / "src" / "data" / "sql-dashboard-repository.js").read_text(encoding="utf-8")
        self.assertIn("paws.vCalendarSession", source)
        self.assertIn("paws.Faculty", source)
        self.assertIn("paws.SessionAssignment", source)
        self.assertNotIn("staging.", source)
        # No Firestore on the Dashboard read path.
        self.assertNotRegex(source, r"firestore|firebase/firestore|collection\(", re.I)
        # No mutation verbs in executable SQL (comments explaining the rule are allowed).
        sql = re.sub(r"//[^\n]*", " ", source)
        self.assertNotRegex(sql, r"INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET|MERGE\s+", re.I)

    def test_dashboard_permission_grant_is_column_scoped(self):
        sql = (ROOT / "database" / "azure-sql" / "004_swa_beta_permissions.sql").read_text(encoding="utf-8")
        self.assertRegex(sql, r"GRANT SELECT ON OBJECT::paws\.Faculty\s*\(")
        self.assertNotRegex(sql, r"GRANT\s+(?:INSERT|UPDATE|DELETE|MERGE|CONTROL|ALTER|EXECUTE)", re.I)
        self.assertNotRegex(sql, r"GRANT\s+SELECT\s+ON\s+SCHEMA::(?:paws|staging)", re.I)
        grant = re.search(r"GRANT SELECT ON OBJECT::paws\.Faculty\s*\(([^)]*)\)", sql, re.S)
        self.assertIsNotNone(grant)
        self.assertNotIn("SourceImportBatchId", grant.group(1))
        self.assertNotIn("SourceRow", grant.group(1))
        # Every GRANT must address the bound runtime principal, never a hardcoded one.
        for statement in re.findall(r"GRANT[^;]*;", sql, re.S):
            self.assertIn("$(PAWS_API_PRINCIPAL)", statement, statement[:80])

    def test_dashboard_readonly_proof_script_exists_and_fails_closed(self):
        proof = (ROOT / "database" / "azure-sql" / "004_swa_beta_permissions_readonly_proof.sql").read_text(encoding="utf-8")
        self.assertIn("READ_ONLY_PROOF_OK", proof)
        self.assertRegex(proof, r"THROW 5110[0-9]")
        # The effective-permission probe must be principal-scoped. HAS_PERMS_BY_NAME
        # evaluates the CALLER, not its principal argument, so running this script
        # as a db_owner would have made that probe meaningless (it reported the
        # db_owner's own rights). The check must therefore be expressed against the
        # runtime principal's own rows, honouring DENY-over-GRANT. The name may
        # still appear in prose explaining why it is avoided.
        executable = re.sub(r"--[^\n]*", " ", proof)
        self.assertNotIn("HAS_PERMS_BY_NAME", executable)
        self.assertIn("grantee_principal_id", proof)
        self.assertIn("deny_row", proof)
        # Positive control so the mutation check cannot be vacuously true.
        self.assertIn("THROW 51108", proof)
        # No hardcoded principal in the diagnostics.
        self.assertNotIn("paws_swa_beta has", proof)
        self.assertNotRegex(proof, r"(?im)^\s*(?:INSERT|UPDATE|DELETE|MERGE|DROP|ALTER)\b")

    def test_dashboard_grant_wrapper_is_additive_only_and_guarded(self):
        # The wrapper is the reviewed live-apply path for the R4D-10A grant. It
        # must be able to prove what it will do without touching the database, and
        # it must fail closed on every precondition.
        wrapper = (ROOT / "database" / "azure-sql" / "apply-dashboard-grant.ps1").read_text(encoding="utf-8")
        self.assertIn("GRANT SELECT ON OBJECT::paws.Faculty", wrapper)
        # Param block must precede any statement, or PowerShell 5.1 cannot parse it.
        self.assertLess(wrapper.index("param("), wrapper.index("Set-StrictMode"))
        # Only additive GRANT: the wrapper never revokes, drops or denies.
        self.assertNotRegex(wrapper, r"\bREVOKE\b")
        self.assertNotRegex(wrapper, r"\bDROP\b")
        # No DML. Context-anchored so prose and `DENY DELETE SCHEMA` rows do not
        # read as mutations (the same false positive guarded against in the
        # Node suite's SQL_MUTATION pattern).
        self.assertNotRegex(wrapper, r"\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bUPDATE\s+\w+\s+SET\b|\bMERGE\s+INTO\b", re.I)
        # Guards that must be present and must throw (not warn and continue).
        for guard in ("EXTERNAL_GROUP", "owns the database", "inherits", "owns schemas or objects"):
            self.assertIn(guard, wrapper)
        self.assertIn("throw", wrapper)
        # Offline rehearsal + SQL emission so the effect is reviewable pre-apply.
        self.assertIn("-SkipConnection", wrapper)
        self.assertIn("-EmitSql", wrapper)
        # The applied statement must address the bound principal, not a literal.
        self.assertIn("TO [$Principal]", wrapper)
        self.assertNotIn("TO [paws_swa_beta]", wrapper)

    def test_userprofile_bootstrap_tool_has_no_database_apply_transport(self):
        source = (ROOT / "tools" / "preview_beta_userprofile_bootstrap.js").read_text(encoding="utf-8")
        self.assertIn("preview-only", source)
        self.assertIn("HUMAN_CONFIRMED_DELETE_ACCOUNT", source)
        self.assertNotIn("mssql", source)
        self.assertNotIn("Invoke-Sqlcmd", source)


if __name__ == "__main__":
    unittest.main()
