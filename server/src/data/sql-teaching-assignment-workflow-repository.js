'use strict';

const CAP_KEYS=['canActAsHicc','canActAsVisc','canDraft','canSubmit','canReview','canFinalSubmit'];
function packageView(row){const result={...row,capabilities:{}};for(const key of CAP_KEYS){result.capabilities[key]=row[key]===true||row[key]===1;delete result[key];}return result;}
const packageState=row=>JSON.stringify(['packageId','academicYear','groupId','responsibleHiccResponsibilityId','status','workingRevision','submittedRevision','approvedRevision','updatedAtUtc',...CAP_KEYS].map(key=>row[key]??null));

function createSqlTeachingAssignmentWorkflowRepository(db) {
  const run=(sql,params={})=>db.query(sql,params);
  const exec=(name,params)=>{
    const bound=Object.fromEntries(Object.entries(params).map(([key,value])=>[key,value===undefined?null:value]));
    return run(`EXEC paws_api.${name}\n${Object.keys(bound).map(key=>`@${key} = @${key}`).join(',\n')}`,bound);
  };
  const hicc=`paws_api.CanActOnTeachingAssignmentPackage(p.TeachingAssignmentPackageId,@actorFirebaseUid,N'hicc')`;
  const visc=`paws_api.CanActOnTeachingAssignmentPackage(p.TeachingAssignmentPackageId,@actorFirebaseUid,N'visc')`;
  const packageScope=`(${hicc}=1 OR ${visc}=1 OR paws_api.CanActOnTeachingAssignmentPackage(p.TeachingAssignmentPackageId,@actorFirebaseUid,N'adfad')=1)`;
  const today=`CONVERT(date,(SYSUTCDATETIME() AT TIME ZONE 'UTC') AT TIME ZONE 'Mountain Standard Time')`;
  const capabilities=`CAST(${hicc} AS bit) canActAsHicc,CAST(${visc} AS bit) canActAsVisc,
    CAST(${hicc} AS bit) canDraft,CAST(IIF(${hicc}=1 AND p.WorkingRevision>0,1,0) AS bit) canSubmit,
    CAST(IIF(${visc}=1 AND p.Status=N'visc_review' AND p.SubmittedWorkingRevision=p.WorkingRevision
      AND NOT EXISTS(SELECT 1 FROM paws.TeachingAssignmentRevision own WHERE own.TeachingAssignmentPackageId=p.TeachingAssignmentPackageId AND own.RevisionNumber=p.WorkingRevision AND own.CreatedByFirebaseUid=@actorFirebaseUid)
      AND NOT EXISTS(SELECT 1 FROM paws.AuditEvent own WHERE own.EntityType=N'TeachingAssignmentPackage' AND own.EntityId=CONVERT(nvarchar(36),p.TeachingAssignmentPackageId) AND own.EventType=N'TeachingAssignmentSubmitted' AND own.ActorFirebaseUid=@actorFirebaseUid AND TRY_CONVERT(int,JSON_VALUE(own.AfterJson,'$.submittedRevision'))=p.WorkingRevision),1,0) AS bit) canReview,
    CAST(IIF(${hicc}=1 AND p.Status=N'visc_approved' AND p.ViscApprovedWorkingRevision=p.WorkingRevision AND p.ViscApprovedFingerprint=p.ReviewFingerprint,1,0) AS bit) canFinalSubmit`;
  const packageQuery=`SELECT p.TeachingAssignmentPackageId AS packageId,p.PackageIdentity AS packageIdentity,p.AcademicYear AS academicYear,p.GroupId AS groupId,g.Name AS groupName,
    p.HiccResponsibilityId AS responsibleHiccResponsibilityId,hr.Label AS hiccLabel,p.Status AS status,p.WorkingRevision AS workingRevision,
    p.SubmittedWorkingRevision AS submittedRevision,p.ViscApprovedWorkingRevision AS approvedRevision,p.ViscReviewComment AS lastReviewComment,
    p.DueAtUtc AS dueAtUtc,p.CreatedAtUtc AS createdAtUtc,p.UpdatedAtUtc AS updatedAtUtc,${capabilities}
    FROM paws.TeachingAssignmentPackage p JOIN paws.TeachingAssignmentGroup g ON g.GroupId=p.GroupId
    JOIN paws.TeachingResponsibility hr ON hr.ResponsibilityId=p.HiccResponsibilityId AND hr.Kind=N'hicc'
    WHERE p.TeachingAssignmentPackageId=@packageId AND ${packageScope}`;
  return Object.freeze({
    async listWorkQueue({actorFirebaseUid,academicYear}) {
      const rows=await run(`SELECT p.TeachingAssignmentPackageId AS packageId,p.AcademicYear AS academicYear,p.GroupId AS groupId,
          g.Name AS groupName,p.HiccResponsibilityId AS responsibleHiccResponsibilityId,hr.Label AS hiccLabel,
          p.Status AS status,p.WorkingRevision AS workingRevision,p.SubmittedWorkingRevision AS submittedRevision,
          p.ViscApprovedWorkingRevision AS approvedRevision,p.DueAtUtc AS dueAtUtc,p.UpdatedAtUtc AS lastActivityAtUtc,
          CASE p.Status WHEN N'draft' THEN N'HICC draft' WHEN N'changes_requested' THEN N'HICC revision'
            WHEN N'visc_review' THEN N'VISC review' WHEN N'visc_approved' THEN N'HICC final submit'
            WHEN N'submitted_to_adfad' THEN N'ADFAD final assignment' WHEN N'adfad_finalized' THEN N'Publish' END AS nextAction,
          assignee.EffectiveAssignee AS effectiveAssignee,assignee.AssigneeCount AS effectiveAssigneeCount,
          CASE WHEN assignee.AssigneeCount>1 THEN N'Conflicting current assignees' END AS warning,${capabilities}
        FROM paws.TeachingAssignmentPackage p
        JOIN paws.TeachingAssignmentGroup g ON g.GroupId=p.GroupId AND g.Active=1
        JOIN paws.TeachingResponsibility hr ON hr.ResponsibilityId=p.HiccResponsibilityId AND hr.Kind=N'hicc' AND hr.Active=1
        OUTER APPLY (SELECT COUNT_BIG(*) AS AssigneeCount,MIN(f.DisplayName) AS EffectiveAssignee
          FROM paws.TeachingResponsibilityAssignee a JOIN paws.Faculty f ON f.FacultyId=a.FacultyId AND f.Active=1
          WHERE a.ResponsibilityId=p.HiccResponsibilityId AND a.AcademicYear=p.AcademicYear AND a.ActiveDate<=${today}
            AND (a.ExpirationDate IS NULL OR ${today}<a.ExpirationDate)) assignee
        WHERE p.AcademicYear=@academicYear AND
          ${packageScope}
        ORDER BY CASE p.Status WHEN N'changes_requested' THEN 0 WHEN N'draft' THEN 1 WHEN N'visc_review' THEN 2 ELSE 3 END,p.DueAtUtc,p.UpdatedAtUtc`,
        {actorFirebaseUid,academicYear});
      return rows.map(packageView);
    },
    async listContributionTargets({academicYear}) {
      return run(`SELECT p.TeachingAssignmentPackageId AS packageId,p.AcademicYear AS academicYear,p.Status AS status,
          p.WorkingRevision AS revisionNumber,g.Name AS groupName,hr.Label AS hiccLabel,
          rs.SessionId AS sessionId,s.CourseCode AS courseCode,s.CourseName AS courseName,s.Topic AS topic,
          s.SessionType AS sessionType,s.SessionDate AS sessionDate,s.StartTime AS startTime,s.EndTime AS endTime
        FROM paws.TeachingAssignmentPackage p
        JOIN paws.TeachingAssignmentGroup g ON g.GroupId=p.GroupId AND g.Active=1
        JOIN paws.TeachingResponsibility hr ON hr.ResponsibilityId=p.HiccResponsibilityId AND hr.Kind=N'hicc' AND hr.Active=1
        JOIN paws.TeachingAssignmentRevision rev ON rev.TeachingAssignmentPackageId=p.TeachingAssignmentPackageId AND rev.RevisionNumber=p.WorkingRevision
        JOIN paws.TeachingAssignmentRevisionSession rs ON rs.RevisionId=rev.RevisionId
        JOIN paws.Session s ON s.SessionId=rs.SessionId
        WHERE p.AcademicYear=@academicYear AND p.Status IN (N'draft',N'changes_requested')
        ORDER BY g.Name,hr.Label,rs.SessionOrder`,{academicYear});
    },
    async getPackage({packageId,actorFirebaseUid}) {
      const p=await run(packageQuery,{packageId,actorFirebaseUid});
      if (!p.length) return null;
      const [sessions,reviews,finalization,contributions]=await Promise.all([
        run(`SELECT rev.RevisionNumber AS revisionNumber,rs.SessionOrder AS sessionOrder,rs.SessionId AS sessionId,s.CourseCode AS courseCode,s.CourseName AS courseName,s.Topic AS topic,s.SessionType AS sessionType,s.SessionDate AS sessionDate,s.StartTime AS startTime,s.EndTime AS endTime,s.Room AS room,
            ri.FacultyId AS facultyId,f.DisplayName AS facultyName,ri.TeachingRole AS teachingRole
          FROM paws.TeachingAssignmentRevision rev JOIN paws.TeachingAssignmentRevisionSession rs ON rs.RevisionId=rev.RevisionId
          JOIN paws.Session s ON s.SessionId=rs.SessionId LEFT JOIN paws.TeachingAssignmentRevisionInstructor ri ON ri.RevisionId=rev.RevisionId AND ri.SessionId=rs.SessionId
          LEFT JOIN paws.Faculty f ON f.FacultyId=ri.FacultyId WHERE rev.TeachingAssignmentPackageId=@packageId
          UNION ALL
          SELECT 0 AS revisionNumber,0 AS sessionOrder,s.SessionId AS sessionId,s.CourseCode AS courseCode,s.CourseName AS courseName,s.Topic AS topic,s.SessionType AS sessionType,s.SessionDate AS sessionDate,s.StartTime AS startTime,s.EndTime AS endTime,s.Room AS room,
            sa.FacultyId AS facultyId,f.DisplayName AS facultyName,sa.TeachingRole AS teachingRole
          FROM paws.TeachingSessionOwnership tso JOIN paws.Session s ON s.SessionId=tso.SessionId
          LEFT JOIN paws.SessionAssignment sa ON sa.SessionId=s.SessionId AND sa.FacultyId IS NOT NULL
          LEFT JOIN paws.Faculty f ON f.FacultyId=sa.FacultyId
          WHERE tso.TeachingAssignmentPackageId=@packageId
            AND NOT EXISTS(SELECT 1 FROM paws.TeachingAssignmentRevision rev WHERE rev.TeachingAssignmentPackageId=@packageId)
          ORDER BY revisionNumber DESC,sessionOrder,facultyId`,{packageId}),
        run(`SELECT RevisionNumber AS revisionNumber,Decision AS decision,Comment AS comment,ActorName AS actorName,ActorResponsibilityId AS actorResponsibilityId,CreatedAtUtc AS createdAtUtc
          FROM paws.TeachingAssignmentReview WHERE TeachingAssignmentPackageId=@packageId ORDER BY CreatedAtUtc DESC`,{packageId}),
        run(`SELECT f.FinalizationId AS finalizationId,f.VersionNumber AS versionNumber,f.RevisionNumber AS revisionNumber,f.ActorName AS actorName,f.FinalNote AS finalNote,f.CreatedAtUtc AS createdAtUtc,
            l.SessionId AS sessionId,l.FacultyId AS facultyId,l.FacultyDisplayName AS facultyName,l.TeachingRole AS teachingRole
          FROM paws.TeachingAssignmentCurrentFinalization c JOIN paws.TeachingAssignmentFinalization f ON f.FinalizationId=c.FinalizationId
          LEFT JOIN paws.TeachingAssignmentFinalizationLine l ON l.FinalizationId=f.FinalizationId WHERE c.TeachingAssignmentPackageId=@packageId`,{packageId}),
        run(`SELECT ContributionId AS contributionId,RevisionNumber AS revisionNumber,SessionId AS sessionId,CandidateKey AS candidateKey,SuggestedDisplayName AS suggestedDisplayName,SuggestedByOffice AS suggestedByOffice,ActorName AS actorName,Note AS note,CreatedAtUtc AS createdAtUtc
          FROM paws.TeachingAssignmentContribution WHERE TeachingAssignmentPackageId=@packageId ORDER BY CreatedAtUtc DESC`,{packageId})
      ]);
      const byRevision=new Map();
      for (const row of sessions) {
        if (!byRevision.has(row.revisionNumber)) byRevision.set(row.revisionNumber,[]);
        const list=byRevision.get(row.revisionNumber);
        let item=list.find(x=>x.sessionId===row.sessionId);
        if (!item) { item={...row,facultyId:undefined,facultyName:undefined,teachingRole:undefined,assignments:[]}; list.push(item); }
        if (row.facultyId) item.assignments.push({facultyId:row.facultyId,facultyName:row.facultyName,teachingRole:row.teachingRole});
      }
      const current=await run(packageQuery,{packageId,actorFirebaseUid});
      if(!current.length)return null;
      if(packageState(current[0])!==packageState(p[0]))throw Object.assign(Error('Package authority or content changed during the read.'),{number:52113});
      return {...packageView(current[0]),revisions:[...byRevision].map(([revisionNumber,items])=>({revisionNumber,sessions:items})),reviews,finalization,contributions};
    },
    async getHistory({packageId,actorFirebaseUid,role}) {
      const pkg=await this.getPackage({packageId,actorFirebaseUid,role});
      if (!pkg) return null;
      const activities=await run(`SELECT EventType AS eventType,ActorName AS actorName,OccurredAtUtc AS occurredAtUtc,BeforeJson AS beforeJson,AfterJson AS afterJson,MetadataJson AS metadataJson FROM paws.AuditEvent WHERE EntityType=N'TeachingAssignmentPackage' AND EntityId=@entityId ORDER BY OccurredAtUtc DESC`,{entityId:packageId});
      const current=await run(packageQuery,{packageId,actorFirebaseUid});if(!current.length)return null;
      if(packageState(current[0])!==packageState({...pkg,...pkg.capabilities}))throw Object.assign(Error('Package changed during the history read.'),{number:52113});
      return {reviews:pkg.reviews,finalizations:pkg.finalization,activities};
    },
    async getPublishedRelease({academicYear,role,facultyId}) {
      if (role==='faculty' && !facultyId) return null;
      const rows=await run(`SELECT r.ReleaseId AS releaseId,r.AcademicYear AS academicYear,r.VersionNumber AS versionNumber,r.PublishedAtUtc AS publishedAtUtc,r.PublishedByName AS publishedBy,r.PublicationNote AS publicationNote
        FROM paws.TeachingAssignmentPublicationState st JOIN paws.TeachingAssignmentPublicationRelease r ON r.ReleaseId=st.CurrentReleaseId
        WHERE st.AcademicYear=@academicYear`,{academicYear});
      if (!rows.length) return null;
      const instructors=await run(`SELECT ps.SessionId AS sessionId,ps.CourseCode AS courseCode,ps.CourseName AS courseName,ps.Topic AS topic,ps.SessionType AS sessionType,ps.SessionDate AS sessionDate,ps.StartTime AS startTime,ps.EndTime AS endTime,ps.Room AS room,
          pi.FacultyId AS facultyId,pi.FacultyDisplayName AS facultyName,pi.TeachingRole AS teachingRole
        FROM paws.TeachingAssignmentPublishedSession ps JOIN paws.TeachingAssignmentPublishedInstructor pi ON pi.PublishedSessionId=ps.PublishedSessionId
        WHERE ps.ReleaseId=@releaseId AND (@facultyId IS NULL OR pi.FacultyId=@facultyId) ORDER BY ps.SessionDate,ps.StartTime,ps.SessionId,pi.FacultyId`,{releaseId:rows[0].releaseId,facultyId:role==='faculty'?facultyId:null});
      const sessions=new Map();
      for (const row of instructors) {
        if (!sessions.has(row.sessionId)) sessions.set(row.sessionId,{sessionId:row.sessionId,courseCode:row.courseCode,courseName:row.courseName,topic:row.topic,sessionType:row.sessionType,sessionDate:row.sessionDate,startTime:row.startTime,endTime:row.endTime,room:row.room,assignments:[]});
        sessions.get(row.sessionId).assignments.push({facultyId:row.facultyId,facultyName:row.facultyName,teachingRole:row.teachingRole});
      }
      return {...rows[0],sessions:[...sessions.values()]};
    },
    listPublicationHistory({academicYear}) {
      return run(`SELECT r.ReleaseId AS releaseId,r.AcademicYear AS academicYear,r.VersionNumber AS versionNumber,r.PublishedAtUtc AS publishedAtUtc,r.PublishedByName AS publishedBy,r.PublicationNote AS publicationNote,
          CASE WHEN st.CurrentReleaseId=r.ReleaseId THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS isCurrent,
          (SELECT COUNT_BIG(*) FROM paws.TeachingAssignmentPublishedSession ps WHERE ps.ReleaseId=r.ReleaseId) AS publishedSessionCount
        FROM paws.TeachingAssignmentPublicationRelease r LEFT JOIN paws.TeachingAssignmentPublicationState st ON st.AcademicYear=r.AcademicYear
        WHERE r.AcademicYear=@academicYear ORDER BY r.VersionNumber DESC`,{academicYear});
    },
    saveDraft(args) { return exec('SaveTeachingAssignmentDraft',{PackageId:args.packageId,ExpectedWorkingRevision:args.expectedWorkingRevision,SessionsJson:JSON.stringify(args.sessions),RevisionNote:args.revisionNote,ActorFirebaseUid:args.actorFirebaseUid}); },
    submit(args) { return exec('SubmitTeachingAssignmentRevision',{PackageId:args.packageId,ExpectedWorkingRevision:args.expectedWorkingRevision,ActorFirebaseUid:args.actorFirebaseUid}); },
    review(args) { return exec('RecordTeachingAssignmentReview',{PackageId:args.packageId,RevisionNumber:args.revisionNumber,Decision:args.decision,Comment:args.comment,ActorFirebaseUid:args.actorFirebaseUid}); },
    addContribution(args) { return exec('AddTeachingAssignmentContribution',{PackageId:args.packageId,RevisionNumber:args.revisionNumber,SessionId:args.sessionId,CandidateKey:args.candidateKey,SuggestedDisplayName:args.suggestedDisplayName,SuggestedByOffice:args.suggestedByOffice,Note:args.note,ActorFirebaseUid:args.actorFirebaseUid}); },
    finalSubmit(args) { return exec('FinalSubmitTeachingAssignment',{PackageId:args.packageId,ExpectedWorkingRevision:args.expectedWorkingRevision,ActorFirebaseUid:args.actorFirebaseUid}); },
    saveFinalization(args) { return exec('SaveTeachingAssignmentFinalization',{PackageId:args.packageId,ExpectedWorkingRevision:args.expectedWorkingRevision,AssignmentsJson:JSON.stringify(args.assignments),FinalNote:args.finalNote,ActorFirebaseUid:args.actorFirebaseUid}); },
    publish(args) { return exec('PublishTeachingAssignmentRelease',{AcademicYear:args.academicYear,PublicationNote:args.publicationNote,ActorFirebaseUid:args.actorFirebaseUid}); }
  });
}

module.exports={createSqlTeachingAssignmentWorkflowRepository};
