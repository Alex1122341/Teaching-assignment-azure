"""Generate a deterministic synthetic PAWS data set as T-SQL.

Every person, UCID, e-mail and purpose here is invented. Nothing is derived from
real PAWS / VetMed-Ops data. Output: seed-base.sql (run after migrations 001-002,
the point at which the real workbook load happened).
"""
import json
import random
import uuid
from datetime import date, time, timedelta
from pathlib import Path

NS = uuid.UUID("5e7e7e7e-0000-4000-8000-000000000001")
rng = random.Random(20261014)
OUT = Path(__file__).with_name("seed-base.sql")


def uid(kind, key):
    return str(uuid.uuid5(NS, f"{kind}|{key}")).upper()


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (date, time)):
        return "'" + v.isoformat() + "'"
    return "N'" + str(v).replace("'", "''") + "'"


rows = []


def insert(table, cols, values):
    rows.append(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(q(v) for v in values)});")


BATCH = uid("batch", "synthetic-1")
rows.append("SET NOCOUNT ON;")
insert("staging.ImportBatch",
       ["ImportBatchId", "StartedAtUtc", "CompletedAtUtc", "Status", "SourceManifestSha256", "ImporterVersion", "ActorUpn", "ValidationSummaryJson"],
       [BATCH, "2026-10-14T00:00:00", "2026-10-14T00:05:00", "complete", "0" * 64, "synthetic-generator-1", "synthetic@example.test",
        json.dumps({"synthetic": True})])

# ---- Courses -------------------------------------------------------------
COURSES = [
    ("VTMD 200", "Intro to VetMed"), ("VTMD 202", "Professional Identity Formation 1"),
    ("VTMD 206", "Healthy Animals 1"), ("VTMD 213", "Animals as Populations"),
    ("VTMD 304", "Science of What Goes Wrong 1 (non-infectious dz)"),
    ("VTMD 308", "Fundamentals of Diagnosis, Management and Treatment"),
    ("VTMD 315", "Sick Animals-Head, oral GIT"), ("VTMD 317", "Sick Animals-Endocrine, renal reproduction"),
]
course_id = {}
for i, (code, name) in enumerate(COURSES, 1):
    course_id[code] = uid("course", code)
    insert("paws.Course", ["CourseId", "CourseCode", "CourseName", "NameStatus", "Source", "SourceImportBatchId", "SourceRow"],
           [course_id[code], code, name, "confirmed", "synthetic", BATCH, i])

# ---- Faculty -------------------------------------------------------------
FIRST = ["Avery", "Blair", "Casey", "Devon", "Emerson", "Finley", "Harper", "Jordan", "Kendall", "Logan",
         "Morgan", "Noel", "Parker", "Quinn", "Reese", "Rowan", "Sage", "Skyler", "Tatum", "Wren",
         "Alexis", "Bailey", "Cameron", "Drew", "Elliot", "Frankie", "Hayden", "Jesse", "Kai", "Lane"]
LAST = ["Testwell", "Sampleton", "Mockford", "Fakeley", "Dummer", "Placeholt", "Synthwood", "Demoine", "Trialson", "Pilotti"]
RANKS = ["Assistant Professor", "Associate Professor", "Professor", "Senior Instructor", "Instructor"]
STREAMS = ["clinical", "teaching_focused", "research"]
faculty = []
for i in range(30):
    first, last = FIRST[i], LAST[i % 10] + ("" if i < 10 else str(i // 10 + 1))
    fid = uid("faculty", i)
    faculty.append(dict(id=fid, first=first, last=last, display=f"{first} {last}", src=f"{last}, {first}",
                        ucid=f"SYN{100000 + i}", email=f"{first.lower()}.{last.lower()}@example.test",
                        active=i < 28))
for i, f in enumerate(faculty):
    reports = faculty[0]["id"] if 0 < i < 10 else (faculty[1]["id"] if i >= 10 else None)
    insert("paws.Faculty",
           ["FacultyId", "RecordType", "PreferredFirstName", "PreferredLastName", "DisplayName", "Ucid", "Email", "Stream",
            "Rank", "Fte", "ReportsToFacultyId", "ReportsToRaw", "Active", "SourceImportBatchId", "SourceRow"],
           [f["id"], "faculty", f["first"], f["last"], f["display"], f["ucid"], f["email"], STREAMS[i % 3],
            RANKS[i % 5], [1.0, 1.0, 0.8, 0.5][i % 4], reports, None, f["active"], BATCH, i + 2])
    insert("paws.FacultyProfessionalProfile",
           ["FacultyId", "TeachingArea", "ProfessionalCategory", "ServiceDate", "PriorYearsExperience", "SourceImportBatchId", "SourceRow"],
           [f["id"], ["Anatomy", "Pathology", "Medicine", "Surgery", "Epidemiology"][i % 5], "Academic",
            date(2010 + i % 15, 7, 1), float(i % 12), BATCH, i + 2])
# Placeholder pools used by swaps / sessional replacement.
for label, rtype in [("Z-Sessional", "sessional_pool"), ("Z-Other", "other_pool")]:
    insert("paws.Faculty", ["FacultyId", "RecordType", "DisplayName", "Active", "SourceImportBatchId"],
           [uid("placeholder", label), rtype, label, True, BATCH])
insert("paws.FacultyAlias", ["FacultyAliasId", "FacultyId", "AliasName", "TargetPreferredSourceName", "TargetDisplayName", "Active", "SourceImportBatchId"],
       [uid("alias", 0), faculty[2]["id"], "Casey M.", faculty[2]["src"], faculty[2]["display"], True, BATCH])
insert("paws.JointAppointment", ["JointAppointmentId", "FacultyId", "HomeFaculty", "JointFaculty", "FteUcvm", "FteOtherFaculty", "SourceImportBatchId"],
       [uid("joint", 0), faculty[5]["id"], "UCVM", "Cumming School of Medicine", 0.5, 0.5, BATCH])

# ---- Users (one per role) ---------------------------------------------------
USERS = [
    ("syn-developer", "developer", None), ("syn-owner", "owner", None), ("syn-admin", "administrator", None),
    ("syn-adfa-general", "adfa_general", None), ("syn-adc", "adc", None), ("syn-lab", "lab", None),
    ("syn-hicc", "hicc", 0), ("syn-visc", "visc", 1), ("syn-faculty-a", "faculty", 2), ("syn-faculty-b", "faculty", 3),
    ("syn-faculty-reportee", "faculty", 4),
]
for uidv, role, fi in USERS:
    f = faculty[fi] if fi is not None else None
    insert("paws.UserProfile", ["FirebaseUid", "Email", "DisplayName", "BaseRole", "FacultyId", "Active", "MustChangePassword", "OfficeName"],
           [uidv, f["email"] if f else f"{uidv}@example.test", f["display"] if f else uidv.replace("syn-", "Synthetic ").title(),
            role, f["id"] if f else None, True, False, "Lab Office" if role == "lab" else None])
insert("paws.UserProfile", ["FirebaseUid", "Email", "DisplayName", "BaseRole", "Active", "MustChangePassword"],
       ["syn-inactive", "inactive@example.test", "Inactive User", "faculty", False, False])
insert("paws.UserProfile", ["FirebaseUid", "Email", "DisplayName", "BaseRole", "Active", "MustChangePassword"],
       ["syn-viewer-legacy", "viewer@example.test", "Legacy Viewer", "viewer", True, False])

# ---- Role definitions + assignments ----------------------------------------
for i, (role, cat) in enumerate([("owner", "admin"), ("administrator", "admin"), ("hicc", "faculty"), ("visc", "faculty"), ("faculty", "faculty")]):
    insert("paws.RoleDefinition", ["RoleDefinitionId", "DatabaseRole", "Category", "FacultyLinked", "SourceImportBatchId", "SourceRow"],
           [uid("roledef", role), role, cat, "Yes" if cat == "faculty" else "No", BATCH, i + 2])
ra_row = 2
def role_assign(fi, rtype, subject, cname=None, doe=None):
    global ra_row
    f = faculty[fi]
    insert("paws.RoleAssignment",
           ["RoleAssignmentId", "FacultyId", "SourceFacultyName", "FacultyResolutionStatus", "AcademicYear", "RoleType",
            "CourseId", "CourseOrSubjectOrRotation", "CourseName", "EffectiveDate", "ExpirationDate", "DoeMappedValue", "SourceImportBatchId", "SourceRow"],
           [uid("role", ra_row), f["id"], f["src"], "preferred_name", "2026-27", rtype, course_id.get(subject), subject, cname,
            date(2026, 7, 1), date(2027, 6, 30), doe, BATCH, ra_row])
    ra_row += 1
for i, (code, name) in enumerate(COURSES):
    role_assign([0, 0, 5, 6, 7, 8, 9, 10][i], "Course Coordinator / HICC", code, name, 3.0)
role_assign(1, "VISC", "Cardiology", None, 5.0)
role_assign(11, "VISC", "Dermatology", None, 5.0)
role_assign(12, "Rotation / Week Lead", "Small Animal Medicine Rotation", None, 1.0)

# ---- DOE rule seed (values migration 026 requires) -------------------------
seed_row = 2
def doe_seed(cat, label, rate, basis, req, auth, stage="2026-27"):
    global seed_row
    raw = dict(category=cat, rule=label, stage=stage, rate=rate, basis=basis, input=req, authoritative=auth)
    insert("paws.DoeRuleSeed", ["DoeRuleSeedId", "Category", "RuleLabel", "AcademicYearOrStage", "RateOrTierPct", "Basis",
                                "RequiredInput", "CalculationOrNote", "AuthoritativeInExcel", "RawJson", "SourceImportBatchId", "SourceRow"],
           [uid("doeseed", seed_row), cat, label, stage, rate, basis, req, "synthetic", auth, json.dumps(raw), BATCH, seed_row])
    seed_row += 1
for label, rate in [("Lecture", "0.3"), ("SRL", "0.3"), ("Lab Primary", "0.21"), ("Lab Secondary", "0.19")]:
    doe_seed("Assigned Teaching", label, rate, "per credited hour", "creditedHours", "Yes")
doe_seed("Development", "VISC", "5", "per subject", "subject mapping", "Used in Role Assignments")
doe_seed("Development", "HICC", "3", "per course", "course mapping", "Used in Role Assignments")

# ---- Sessions + assignments -------------------------------------------------
TYPES = ["LEC"] * 5 + ["LAB"] * 3 + ["SRL"] * 2 + ["Quiz/Midterm", "OSCE", "Exam"]
ROOMS = ["TRW 1E20", "TRW 2D15", "HSC G500", "CWPC Lab A", "CWPC Lab B"]
d = date(2026, 9, 8)
active_fac = [i for i, f in enumerate(faculty) if f["active"]]
sa_row = 2
sessions = 0
while d <= date(2027, 4, 23):
    if d.weekday() < 5 and not (date(2026, 12, 19) <= d <= date(2027, 1, 4)):
        for slot in range(rng.choice([1, 2, 2, 3])):
            code, cname = rng.choice(COURSES)
            stype = rng.choice(TYPES)
            start = time(8 + slot * 3, rng.choice([0, 30]))
            end = time(start.hour + (3 if stype == "LAB" else 1), start.minute + 50 if start.minute == 0 else 20)
            sid = uid("session", sessions)
            insert("paws.Session", ["SessionId", "AcademicYear", "CurriculumYear", "CourseId", "CourseCode", "CourseName", "Topic",
                                    "SessionType", "SessionDate", "StartTime", "EndTime", "Room", "SourceImportBatchId"],
                   [sid, "2026-27", str(int(code.split()[1][0]) - 1), course_id[code], code, cname,
                    f"Synthetic topic {sessions + 1}", stype, d, start, end, rng.choice(ROOMS), BATCH])
            people = rng.sample(active_fac, 2 if stype == "LAB" else 1)
            for k, fi in enumerate(people):
                f = faculty[fi]
                role = ("Lab Primary" if k == 0 else "Lab Secondary") if stype == "LAB" else ("SRL" if stype == "SRL" else "Lecture")
                hrs = 3.0 if stype == "LAB" else 1.0
                rate = {"Lecture": 0.3, "SRL": 0.3, "Lab Primary": 0.21, "Lab Secondary": 0.19}[role]
                credit = stype not in ("Quiz/Midterm", "OSCE")
                insert("paws.SessionAssignment",
                       ["SessionAssignmentId", "SessionId", "FacultyId", "SourceFacultyName", "FacultyResolutionStatus", "TeachingRole",
                        "LabLead", "CreditedHours", "DoeRate", "DoeQuantity", "DoeUnit", "DoeCredit", "DoeStatus", "SourceImportBatchId", "SourceRow"],
                       [uid("sa", sa_row), sid, f["id"], f["src"], "preferred_name", role, "Yes" if role == "Lab Primary" else None,
                        hrs if credit else 0.0, rate, hrs, "hour", round(rate * hrs, 6) if credit else 0.0,
                        "calculated" if credit else "non-credit", BATCH, sa_row])
                sa_row += 1
            # occasional sessional cover
            if rng.random() < 0.03:
                insert("paws.SessionAssignment",
                       ["SessionAssignmentId", "SessionId", "FacultyId", "SourceFacultyName", "FacultyResolutionStatus", "TeachingRole", "SourceImportBatchId", "SourceRow"],
                       [uid("sa", sa_row), sid, uid("placeholder", "Z-Sessional"), "Z-Sessional", "placeholder", "Lecture", BATCH, sa_row])
                sa_row += 1
            sessions += 1
    d += timedelta(days=1)

# ---- AFC (away from campus) records ----------------------------------------
PURPOSES = ["Conference attendance (synthetic)", "Research field work (synthetic)", "Professional development (synthetic)", "Personal (synthetic)"]
for i in range(45):
    fi = rng.choice(active_fac)
    start = date(2026, 9, 1) + timedelta(days=rng.randrange(0, 240))
    insert("paws.AfcRecord", ["AfcRecordId", "FacultyId", "StartDate", "EndDate", "Purpose", "Active", "SourceImportBatchId", "SourceRow"],
           [uid("afc", i), faculty[fi]["id"], start, start + timedelta(days=rng.choice([0, 1, 2, 4])), rng.choice(PURPOSES), i % 15 != 0, BATCH, i + 2])

rows.append("PRINT N'SYNTHETIC_SEED_BASE_OK sessions=" + str(sessions) + " assignments=" + str(sa_row - 2) + "';")
OUT.write_text("\n".join(rows) + "\n", encoding="utf-8")
manifest = dict(faculty=len(faculty), sessions=sessions, sessionAssignments=sa_row - 2, afc=45, users=len(USERS) + 2,
                roleAssignments=ra_row - 2, courses=len(COURSES))
Path(__file__).with_name("seed-manifest.json").write_text(json.dumps(manifest, indent=2))
print(manifest)
