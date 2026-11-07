import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translate, setLanguage, isAppLanguage, translationCoverage, regionLanguageCodes } from '../src/i18n.ts';

test('local language switching, persistence, fallbacks and region defaults', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) };
  assert.equal(setLanguage('as'), true);
  assert.equal(translate('My memories'), 'মোৰ স্মৃতি');
  assert.equal(values.get('smriti-ui-language'), 'as');
  setLanguage('bn');
  assert.equal(translate('My memories'), 'আমার স্মৃতি');
  setLanguage('hi');
  assert.equal(translate('My memories'), 'मेरी यादें');
  assert.equal(translate('Missing static message'), 'Missing static message');
  assert.equal(translate('Another message', 'हिन्दी विकल्प'), 'हिन्दी विकल्प');
  setLanguage('en');
  assert.equal(translate('My memories'), 'My memories');
  assert.equal(isAppLanguage('not-a-language'), false);
  assert.equal(isAppLanguage('mni'), false); // unfinished packs cannot be selected
  assert.equal(setLanguage('unsupported'), false);
  assert.equal(regionLanguageCodes.Assam, 'as');
  assert.equal(regionLanguageCodes.Tripura, 'bn');
  globalThis.localStorage.setItem = () => { throw Error('Storage blocked'); };
  assert.equal(setLanguage('bn'), false);
  assert.equal(translate('My memories'), 'আমার স্মৃতি'); // session still works
  setLanguage('en');
  delete globalThis.localStorage;
});

test('review templates have every catalog key and no fabricated translations', () => {
  const en = JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url)));
  for(const code of ['njz','mni','kha','lus','nag','ne']) {
    const pending = JSON.parse(readFileSync(new URL(`../src/locales/pending/${code}.json`, import.meta.url)));
    assert.deepEqual(Object.keys(pending).sort(), Object.keys(en).sort());
    assert.ok(Object.values(pending).every(value => value === ''));
  }
  for(const code of ['hi','as','bn']) {
    const coverage = translationCoverage(code);
    assert.ok(coverage.translated > 100);
    assert.ok(coverage.translated <= coverage.total);
  }
});
