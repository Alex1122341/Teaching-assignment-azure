'use strict';

// Firestore implementation of the existing PAWS Change History repository
// contract. The canonical API performs Firebase authorization and per-person
// projection before any audit information can reach a browser.
const PROJECT = 'vista-teaching-lab';
const MAX_EVENTS = 10000;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SCOPES = new Set(['mine', 'timetable', 'dashboard']);
const FIELDS = ['eventId', 'source', 'eventType', 'entityType', 'entityId',
  'occurredAtUtc', 'actorFirebaseUid', 'actorName', 'academicYear',
  'beforeJson', 'afterJson', 'contextJson', 'metadataJson', 'facultyId'];
const historyLimit = () => Object.assign(Error('Testing history exceeds safe bounds'), { code:'HISTORY_LIMIT' });

function createLabHistoryRepository({ db } = {}) {
  if (!db || db.projectId !== PROJECT || db.databaseId !== '(default)' ||
      typeof db.collection !== 'function') throw Error('Testing Firestore project rejected');
  return Object.freeze({
    async list({ actorFirebaseUid, scope, start, end, startUtc, endUtc } = {}) {
      if (typeof actorFirebaseUid !== 'string' || !actorFirebaseUid ||
          !SCOPES.has(scope)) throw Error('Invalid Testing history context');
      const from = scope === 'dashboard' ? startUtc : start + 'T00:00:00.000Z';
      const to = scope === 'dashboard' ? endUtc : end + 'T00:00:00.000Z';
      if (!UTC.test(from || '') || !UTC.test(to || '') || from >= to)
        throw Error('Invalid Testing history window');
      // An explicit limit is essential: listing the full collection is never
      // permitted, even with synthetic data. Single-field ordering requires
      // no modification to the shared lab's Firestore index configuration.
      const snapshot = await db.collection('paws_testing_audit')
        .orderBy('occurredAtUtc', 'desc').limit(MAX_EVENTS + 1).get();
      if (!Array.isArray(snapshot?.docs) || snapshot.docs.length > MAX_EVENTS) throw historyLimit();
      const events = [];
      for (const doc of snapshot.docs) {
        const raw = doc.data();
        if (!raw || raw.synthetic !== true) throw Error('Non-synthetic Testing audit rejected');
        const when = raw.occurredAtUtc;
        if (!UTC.test(when || '') || !Number.isFinite(Date.parse(when)))
          throw Error('Invalid Testing audit timestamp');
        if (when < from || when >= to) continue;
        if (typeof raw.eventId !== 'string' || typeof raw.eventType !== 'string')
          throw Error('Incomplete Testing audit rejected');
        const projected = {};
        for (const field of FIELDS) if (Object.hasOwn(raw, field)) projected[field] = raw[field];
        events.push(projected);
      }
      return events;
    }
  });
}

module.exports = { createLabHistoryRepository };
