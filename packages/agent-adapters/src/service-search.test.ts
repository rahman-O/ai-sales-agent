import assert from 'node:assert/strict';
import test from 'node:test';
import { matchServices, normalizeSearchText, type ServiceRow } from './service-search.js';

const DEMO_SERVICES: ServiceRow[] = [
  { id: 'svc-1', name: 'Dental Consultation (Demo Synthetic)', booking_enabled: true },
  { id: 'svc-2', name: 'Teeth Cleaning (Demo Synthetic)', booking_enabled: true },
  { id: 'svc-3', name: 'Dental Check-up (Demo Synthetic)', booking_enabled: true },
];

test('normalizeSearchText normalizes Arabic letter variants, diacritics, and English casing', () => {
  // Arabic variants
  assert.equal(normalizeSearchText('إستشارة'), 'استشاره');
  assert.equal(normalizeSearchText('فَحْصٌ'), 'فحص');
  assert.equal(normalizeSearchText('تنظيف الأسنان'), 'تنظيف الاسنان');
  assert.equal(normalizeSearchText('مُعَايَنَة'), 'معاينه');
  assert.equal(normalizeSearchText('كشفية'), 'كشفيه');

  // English casing and whitespace
  assert.equal(normalizeSearchText('  Dental   Check-Up  '), 'dental check up');
  assert.equal(normalizeSearchText('TEETH CLEANING'), 'teeth cleaning');
});

test('matchServices matches Arabic natural queries to correct catalog services', () => {
  // فحص أسنان -> Dental Check-up
  const checkupMatches = matchServices(DEMO_SERVICES, 'فحص أسنان');
  assert.ok(checkupMatches.length > 0);
  assert.equal(checkupMatches[0]?.id, 'svc-3');
  assert.equal(checkupMatches[0]?.name, 'Dental Check-up (Demo Synthetic)');

  // كشف -> Dental Check-up
  const kashfMatches = matchServices(DEMO_SERVICES, 'كشف');
  assert.ok(kashfMatches.length > 0);
  assert.equal(kashfMatches[0]?.id, 'svc-3');

  // تنظيف أسنان -> Teeth Cleaning
  const cleaningMatches = matchServices(DEMO_SERVICES, 'تنظيف أسنان');
  assert.ok(cleaningMatches.length > 0);
  assert.equal(cleaningMatches[0]?.id, 'svc-2');
  assert.equal(cleaningMatches[0]?.name, 'Teeth Cleaning (Demo Synthetic)');

  // تنظيف -> Teeth Cleaning
  const tanzeefMatches = matchServices(DEMO_SERVICES, 'تنظيف');
  assert.ok(tanzeefMatches.length > 0);
  assert.equal(tanzeefMatches[0]?.id, 'svc-2');

  // استشارة -> Dental Consultation
  const consultMatches = matchServices(DEMO_SERVICES, 'استشارة');
  assert.ok(consultMatches.length > 0);
  assert.equal(consultMatches[0]?.id, 'svc-1');
  assert.equal(consultMatches[0]?.name, 'Dental Consultation (Demo Synthetic)');
});

test('matchServices matches English natural queries to correct catalog services', () => {
  // check up -> Dental Check-up
  const checkup = matchServices(DEMO_SERVICES, 'check up');
  assert.ok(checkup.length > 0);
  assert.equal(checkup[0]?.id, 'svc-3');

  // cleaning -> Teeth Cleaning
  const cleaning = matchServices(DEMO_SERVICES, 'cleaning');
  assert.ok(cleaning.length > 0);
  assert.equal(cleaning[0]?.id, 'svc-2');

  // consultation -> Dental Consultation
  const consult = matchServices(DEMO_SERVICES, 'consultation');
  assert.ok(consult.length > 0);
  assert.equal(consult[0]?.id, 'svc-1');
});

test('matchServices returns empty array for unknown or unrelated queries', () => {
  const unknown1 = matchServices(DEMO_SERVICES, 'حلاقة شعر');
  assert.equal(unknown1.length, 0);

  const unknown2 = matchServices(DEMO_SERVICES, 'car repair service');
  assert.equal(unknown2.length, 0);

  const unknown3 = matchServices(DEMO_SERVICES, 'xyz999foobar');
  assert.equal(unknown3.length, 0);
});

test('matchServices respects tenant boundary by only matching supplied tenant rows', () => {
  const tenantServices: ServiceRow[] = [
    { id: 't1-svc', name: 'General Dental Check-up', booking_enabled: true },
  ];
  const res = matchServices(tenantServices, 'تنظيف أسنان');
  // Tenant doesn't have cleaning service -> empty
  assert.equal(res.length, 0);

  const res2 = matchServices(tenantServices, 'فحص أسنان');
  assert.equal(res2.length, 1);
  assert.equal(res2[0]?.id, 't1-svc');
});
