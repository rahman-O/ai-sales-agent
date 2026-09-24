import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveQualificationState,
  isValidTransition,
  mergeMissingQualification,
  isDisqualifiedReason,
  isArchivedReason,
} from './lead-state.js';

test('deriveQualificationState: incomplete without service', () => {
  assert.equal(
    deriveQualificationState(
      {
        primaryServiceId: null,
        locationId: 'l1',
        needSummary: 'need',
        preferredContactChannel: 'whatsapp',
      },
      { activeLocationCount: 1 },
    ),
    'INCOMPLETE',
  );
});

test('deriveQualificationState: single location does not require locationId', () => {
  assert.equal(
    deriveQualificationState(
      {
        primaryServiceId: 's1',
        locationId: null,
        needSummary: 'whitening',
        preferredContactChannel: 'whatsapp',
      },
      { activeLocationCount: 1 },
    ),
    'SUFFICIENT',
  );
});

test('deriveQualificationState: multi-location requires locationId', () => {
  assert.equal(
    deriveQualificationState(
      {
        primaryServiceId: 's1',
        locationId: null,
        needSummary: 'whitening',
        preferredContactChannel: 'whatsapp',
      },
      { activeLocationCount: 2 },
    ),
    'INCOMPLETE',
  );
  assert.equal(
    deriveQualificationState(
      {
        primaryServiceId: 's1',
        locationId: 'l2',
        needSummary: 'whitening',
        preferredContactChannel: 'whatsapp',
      },
      { activeLocationCount: 2 },
    ),
    'SUFFICIENT',
  );
});

test('transitions: AI cannot archive/disqualify', () => {
  assert.equal(isValidTransition('NEW', 'ARCHIVED', 'AI'), false);
  assert.equal(isValidTransition('ENGAGED', 'DISQUALIFIED', 'AI'), false);
  assert.equal(isValidTransition('NEW', 'ENGAGED', 'AI'), true);
  assert.equal(isValidTransition('DISQUALIFIED', 'ARCHIVED', 'HUMAN'), true);
});

test('reason vocabularies are separate', () => {
  assert.equal(isDisqualifiedReason('NOT_INTERESTED'), true);
  assert.equal(isDisqualifiedReason('MERGED_AFTER_CUSTOMER_MERGE'), false);
  assert.equal(isArchivedReason('MERGED_DUPLICATE_OPEN_LEAD'), true);
  assert.equal(isArchivedReason('NOT_INTERESTED'), false);
});

test('mergeMissingQualification never overwrites non-null', () => {
  const m = mergeMissingQualification(
    {
      primaryServiceId: 'a',
      locationId: null,
      needSummary: 'keep',
      preferredContactChannel: null,
      language: 'ar',
      urgency: null,
    },
    {
      primaryServiceId: 'b',
      locationId: 'loc',
      needSummary: 'lose',
      preferredContactChannel: 'phone',
      language: 'en',
      urgency: 'HIGH',
    },
  );
  assert.equal(m.primaryServiceId, 'a');
  assert.equal(m.locationId, 'loc');
  assert.equal(m.needSummary, 'keep');
  assert.equal(m.preferredContactChannel, 'phone');
  assert.equal(m.language, 'ar');
  assert.equal(m.urgency, 'HIGH');
});
