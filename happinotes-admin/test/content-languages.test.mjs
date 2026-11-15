import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentLanguages, languageByKey, normalizeLanguageSearch, searchContentLanguages, selectedLanguageKey } from '../lib/content-languages.ts';
import isoLanguages from '../lib/data/iso-languages.json' with { type: 'json' };
import censusNames from '../lib/data/india-census-languages.json' with { type: 'json' };

test('catalog retains every source ISO code with unique keys and selectable names', () => {
  assert.ok(isoLanguages.length > 7800);
  assert.equal(new Set(contentLanguages.map(x => x.key)).size, contentLanguages.length);
  assert.equal(new Set(contentLanguages.map(x => x.name)).size, contentLanguages.length);
  for (const row of isoLanguages) assert.equal(languageByKey.get(row.code)?.code, row.code);
});

test('all 121 Census groups and every published named mother tongue remain searchable', () => {
  assert.equal(censusNames.filter(name => /^\d+ /.test(name)).length, 121);
  for (const row of censusNames) {
    const name = row.replace(/^\d+\s+/, '');
    const normalized = normalizeLanguageSearch(name);
    assert.ok(searchContentLanguages(name).some(item => item.indian && [item.name, ...item.aliases].some(alias => normalizeLanguageSearch(alias) === normalized)), name);
  }
});

test('all scheduled Indian languages support native names and common alternative names', () => {
  const cases = {
    'অসমীয়া': 'asm', 'বাংলা': 'ben', Bodo: 'brx', Dogri: 'doi', 'ગુજરાતી': 'guj',
    'हिंदी': 'hin', 'ಕನ್ನಡ': 'kan', Kashmiri: 'kas', 'कोंकणी': 'kok', 'मैथिली': 'mai',
    'മലയാളം': 'mal', Meitei: 'mni', 'मराठी': 'mar', 'नेपाली': 'nep', Odia: 'ori',
    Punjabi: 'pan', Sanskrit: 'san', Santhali: 'sat', Sindhi: 'snd', 'தமிழ்': 'tam',
    'తెలుగు': 'tel', 'اردو': 'urd',
  };
  for (const [query, code] of Object.entries(cases)) assert.ok(searchContentLanguages(query).some(item => item.code === code), query);
});

test('ISO codes, accents and less common international languages are searchable without a result cap', () => {
  for (const [query, code] of [['EN', 'eng'], ['fra', 'fra'], ['francais', 'fra'], ['日本語', 'jpn'], ['Zulu', 'zul'], ['Taushiro', 'trr']]) {
    assert.equal(searchContentLanguages(query)[0].code, code);
  }
  assert.equal(searchContentLanguages('').length, contentLanguages.length);
  assert.ok(searchContentLanguages('a').length > 1000);
  assert.notEqual(normalizeLanguageSearch('हिंदी'), normalizeLanguageSearch('हदी'));
});

test('existing names and custom dialects are never silently converted to ISO codes or a different name', () => {
  assert.equal(selectedLanguageKey('English'), 'eng');
  for (const oldValue of ['Oriya', 'Panjabi', 'english', 'Local dialect — Valley A', '']) {
    assert.equal(selectedLanguageKey(oldValue), null);
  }
  assert.equal(searchContentLanguages('Local dialect — Valley A').length, 0);
});
