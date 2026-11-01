# PR155: future Faculty activation governance promotion

- Previously accepted Beta: `5752b148b1966943910e87e1cfe2c272b934b072`.
- Reviewed immutable product commit: `e4abbc9a3566c15da81c6610d42ff97e388f7912`.
- This separate governance commit changes no shipped frontend/API source bytes.
- Static changed exactly six protected assets: faculty-admin.html, faculty-admin.js, faculty-admin-management.js, paws-data-client.js, timetable.js, teaching-assignments.js. All other static hashes stay identical.
- API changed exactly eight existing runtime modules: server/src/data/dashboard-api.js, server/src/data/data-api.js, server/src/data/sql-account-access-repository.js, server/src/data/sql-dashboard-repository.js, server/src/data/sql-faculty-admin-repository.js, server/src/data/sql-user-repository.js, server/src/runtime/swa-dashboard-functions.js, server/src/teaching-assignment/teaching-assignment-api.js. Inventory and build inputs remain intact.
- SQL added migration 065, its acceptance and guarded rollback; prior SQL untouched. Migration is NOT applied by GitHub merge.
- No changed Node dependencies, Firebase rules/indexes or deployment descriptors.
- Admin write gate and admin identity control creation; date check and manual deactivation are enforced in database triggers.
- New independent labeled synthetic Docker SQL workflow validates pre-start rejection, inclusive date eligibility, deactivation, creation and rollback.
- Historical PR154 product evidence remains anchored in the `5752b148b1966943910e87e1cfe2c272b934b072` Git snapshot; historical acceptance is preserved.
- No RDC, SQL server access or deployment occurred while authoring this PR.
