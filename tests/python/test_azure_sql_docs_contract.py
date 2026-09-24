import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class AzureSqlDocsContractTests(unittest.TestCase):
    def test_ci_is_read_only_and_runs_migration_tests_without_azure_credentials(self):
        workflow = (ROOT / ".github" / "workflows" / "azure-sql-migration-test.yml").read_text(encoding="utf-8")
        self.assertIn('python-version: "3.11"', workflow)
        self.assertIn('tools/requirements-azure-sql-migration.txt', workflow)
        self.assertIn('test_azure_sql_*.py', workflow)
        self.assertIn('contents: read', workflow)
        for forbidden in ['AZURE_', 'secrets.', 'azure/login', 'workflow_dispatch']:
            self.assertNotIn(forbidden, workflow)

    def test_operator_docs_define_private_package_plan_then_destructive_apply(self):
        docs = (ROOT / "docs" / "azure-sql-migration.md").read_text(encoding="utf-8")
        self.assertIn('private', docs.casefold())
        self.assertIn('do not commit', docs.casefold())
        self.assertIn('ucvm-teaching-lab-xz-20260911.database.windows.net', docs)
        self.assertIn('teaching-assignment-lab', docs)
        self.assertIn('plan_paws_azure_sql_reset.ps1', docs)
        self.assertIn('import_paws_azure_sql.ps1', docs)
        self.assertIn('destructive', docs.casefold())
        self.assertIn('RESET teaching-assignment-lab', docs)
        self.assertIn('Firestore is not a source', docs)
        self.assertIn('staging', docs)
        self.assertIn('unresolved', docs.casefold())
        self.assertIn('invalid', docs.casefold())


if __name__ == "__main__":
    unittest.main()