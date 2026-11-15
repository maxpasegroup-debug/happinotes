import isoLanguages from './data/iso-languages.json' with { type: 'json' };
import censusNames from './data/india-census-languages.json' with { type: 'json' };

export type ContentLanguage = {
  key: string;
  name: string;
  code?: string;
  aliases: string[];
  indian: boolean;
  description: string;
};

// Familiar display names and native-script search aliases. ISO reference names
// remain searchable; this never rewrites language strings on existing books.
const indianNames: Record<string, [string, ...string[]]> = {
  asm: ['Assamese', 'অসমীয়া'], ben: ['Bengali', 'Bangla', 'বাংলা'],
  brx: ['Bodo', 'Boro', 'बड़ो'], doi: ['Dogri', 'डोगरी'],
  guj: ['Gujarati', 'ગુજરાતી'], hin: ['Hindi', 'हिन्दी', 'हिंदी'],
  kan: ['Kannada', 'ಕನ್ನಡ'], kas: ['Kashmiri', 'کٲشُر', 'कॉशुर'],
  kok: ['Konkani', 'कोंकणी'], mai: ['Maithili', 'मैथिली'],
  mal: ['Malayalam', 'മലയാളം'], mni: ['Manipuri', 'Meitei', 'Meiteilon', 'ꯃꯤꯇꯩꯂꯣꯟ'],
  mar: ['Marathi', 'मराठी'], nep: ['Nepali', 'नेपाली'],
  ori: ['Odia', 'Oriya', 'ଓଡ଼ିଆ'], pan: ['Punjabi', 'Panjabi', 'ਪੰਜਾਬੀ'],
  san: ['Sanskrit', 'संस्कृतम्'], sat: ['Santali', 'Santhali', 'ᱥᱟᱱᱛᱟᱲᱤ'],
  snd: ['Sindhi', 'سنڌي', 'सिन्धी'], tam: ['Tamil', 'தமிழ்'],
  tel: ['Telugu', 'తెలుగు'], urd: ['Urdu', 'اردو'],
};

const internationalAliases: Record<string, string[]> = {
  eng: ['English'], spa: ['Español'], fra: ['Français'], deu: ['Deutsch'],
  por: ['Português'], ita: ['Italiano'], rus: ['Русский'], zho: ['中文', 'Chinese'],
  cmn: ['普通话', 'Mandarin'], jpn: ['日本語'], kor: ['한국어'], ara: ['العربية'],
  fas: ['فارسی', 'Farsi'], tur: ['Türkçe'], vie: ['Tiếng Việt'],
  tha: ['ไทย'], ind: ['Bahasa Indonesia'], swa: ['Kiswahili'],
};

export function normalizeLanguageSearch(value: string): string {
  // Strip Latin accents only. Removing every combining mark corrupts Indic
  // vowel signs and makes different native-script language names collide.
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
    .toLowerCase().replace(/[()/_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildCatalog(): ContentLanguage[] {
  const languages: ContentLanguage[] = isoLanguages.map((entry) => ({
    key: entry.code,
    name: indianNames[entry.code]?.[0] ?? (entry.code === 'ory' ? 'Odia (individual language)' : entry.name),
    code: entry.code,
    aliases: [entry.name, ...entry.codes, ...(indianNames[entry.code] ?? []), ...(internationalAliases[entry.code] ?? [])],
    indian: Boolean(indianNames[entry.code]),
    description: `ISO ${entry.code.toUpperCase()} · ${entry.scope === 'macrolanguage' ? 'Language group' : entry.type}`,
  }));
  const byName = new Map<string, ContentLanguage>();
  for (const language of languages) {
    for (const name of [language.name, ...language.aliases]) {
      byName.set(normalizeLanguageSearch(name), language);
    }
  }
  for (const [index, rawName] of censusNames.entries()) {
    const name = rawName.replace(/^\d+\s+/, '').toLowerCase().replace(/(^|[\s/(-])\p{L}/gu, (part) => part.toUpperCase());
    const existing = byName.get(normalizeLanguageSearch(name));
    if (existing) {
      existing.indian = true;
      existing.aliases.push(name);
    } else {
      // Census groupings are not always one-to-one ISO languages. Retain the
      // published grouping instead of assigning an unverified ISO code.
      const language: ContentLanguage = {
        key: `census-${index}`, name, aliases: [], indian: true,
        description: 'India · Census language / mother tongue',
      };
      languages.push(language);
      byName.set(normalizeLanguageSearch(name), language);
    }
  }
  return languages.sort((a, b) => Number(b.indian || b.code === 'eng') - Number(a.indian || a.code === 'eng') || a.name.localeCompare(b.name, 'en') || a.key.localeCompare(b.key, 'en'));
}

export const contentLanguages = buildCatalog();
export const languageByKey = new Map(contentLanguages.map((language) => [language.key, language]));
const searchIndex = contentLanguages.map((language) => ({
  language,
  terms: [language.name, language.code ?? '', ...language.aliases].map(normalizeLanguageSearch),
}));

export function searchContentLanguages(query: string): ContentLanguage[] {
  const normalized = normalizeLanguageSearch(query);
  if (!normalized) return contentLanguages;
  const exact: ContentLanguage[] = [];
  const partial: ContentLanguage[] = [];
  const tokens = normalized.split(' ');
  for (const { language, terms } of searchIndex) {
    if (terms.includes(normalized)) exact.push(language);
    else if (tokens.every((token) => terms.some((term) => term.includes(token)))) partial.push(language);
  }
  return [...exact, ...partial];
}

// Exact display-name matching only: an old name such as Oriya stays Oriya
// until the administrator deliberately selects a different catalog entry.
export function selectedLanguageKey(value: string): string | null {
  return contentLanguages.find((language) => language.name === value)?.key ?? null;
}
