import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAuthorizeUrl, toStored, locationSummary, configured } from './_lib/google-oauth.js';

test('buildAuthorizeUrl requests offline access and the business.manage scope', () => {
  const u = new URL(buildAuthorizeUrl({ redirectUri: 'http://localhost:5173/api/google/oauth/callback', state: 'abc123' }));
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('redirect_uri'), 'http://localhost:5173/api/google/oauth/callback');
  assert.equal(u.searchParams.get('state'), 'abc123');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('prompt'), 'consent');
  assert.equal(u.searchParams.get('include_granted_scopes'), 'true');
  assert.ok((u.searchParams.get('scope') || '').includes('https://www.googleapis.com/auth/business.manage'));
});

test('toStored keeps previous refresh token, account and locations', () => {
  const prev = {
    access_token: 'old', refresh_token: 'keep-me', expires_at: 1, scope: 's',
    account: { email: 'maria@example.com' },
    locations: [{ name: 'accounts/1/locations/1', title: 'Shop' }],
    location: { name: 'accounts/1/locations/1' },
  };
  const stored = toStored({ access_token: 'new', expires_in: 3600 }, prev);
  assert.equal(stored.access_token, 'new');
  assert.equal(stored.refresh_token, 'keep-me');
  assert.deepEqual(stored.account, { email: 'maria@example.com' });
  assert.equal(stored.locations.length, 1);
  assert.equal(stored.location.name, 'accounts/1/locations/1');
  assert.ok(stored.expires_at > Date.now());
  const rotated = toStored({ access_token: 'new2', refresh_token: 'rotated' }, prev);
  assert.equal(rotated.refresh_token, 'rotated');
});

test('locationSummary flattens a GBP location', () => {
  const loc = {
    name: 'accounts/1/locations/9',
    title: 'Maple Street Auto Repair',
    storefrontAddress: { addressLines: ['1234 Maple St SE', 'Suite B'], locality: 'Decatur', administrativeArea: 'GA', postalCode: '30030' },
    phoneNumbers: { primaryPhone: '(404) 555-0100' },
    websiteUri: 'https://maplestreetauto.example.com',
    regularHours: { periods: [{ openDay: 'MONDAY', openTime: '08:00', closeDay: 'MONDAY', closeTime: '18:00' }] },
    categories: { primaryCategory: { displayName: 'Auto repair shop' }, additionalCategories: [{ displayName: 'Brake shop' }, { displayName: 'Oil change service' }] },
    serviceArea: { places: { placeInfos: [{ placeName: 'Decatur, GA' }, { placeName: 'Avondale Estates, GA' }] } },
    profile: { description: 'Honest auto repair in Decatur.' },
    metadata: { mapsUri: 'https://maps.google.com/?cid=1', newReviewUri: 'https://g.page/r/1/review' },
  };
  const s = locationSummary(loc);
  assert.equal(s.name, 'accounts/1/locations/9');
  assert.equal(s.title, 'Maple Street Auto Repair');
  assert.equal(s.address, '1234 Maple St SE Suite B, Decatur, GA, 30030');
  assert.equal(s.phone, '(404) 555-0100');
  assert.equal(s.website, 'https://maplestreetauto.example.com');
  assert.equal(s.hours.length, 1);
  assert.equal(s.primaryCategory, 'Auto repair shop');
  assert.deepEqual(s.additionalCategories, ['Brake shop', 'Oil change service']);
  assert.deepEqual(s.serviceArea, ['Decatur, GA', 'Avondale Estates, GA']);
  assert.equal(s.description, 'Honest auto repair in Decatur.');
  assert.equal(s.mapsUri, 'https://maps.google.com/?cid=1');
  assert.equal(s.newReviewUri, 'https://g.page/r/1/review');
  assert.equal(locationSummary({}).address, null);
});

test('configured() is false without client env vars', () => {
  assert.equal(configured(), false);
});
