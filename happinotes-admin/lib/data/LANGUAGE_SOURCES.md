# Audiobook language catalog

Snapshot downloaded: 2026-11-16. These are content metadata choices, not UI translations.

## International catalog

`iso-languages.json` contains all **7,867 entries** from
[wooorm/iso-639-3's generated table](https://github.com/wooorm/iso-639-3/blob/main/iso6393.js),
downloaded from `https://raw.githubusercontent.com/wooorm/iso-639-3/main/iso6393.js`.
The upstream table derives from the [ISO 639-3 registry](https://iso639-3.sil.org/code_tables/download_tables).
Its MIT license is preserved in `iso-languages.LICENSE`.

Original upstream JavaScript SHA-256:
`47b2e64bd7c7683c5ba578d7e39cd2b580f54f6b307a243ffac1e836a607bfbf`.

Each record retains the ISO 639-3 code, reference name, type, scope, and additional
ISO 639-1/639-2 codes (deduplicated). No ISO entries are excluded. This snapshot
contains 7,027 living entries and also historical, extinct, ancient, constructed,
and special entries; it must not be advertised as 7,867 living languages. Language
counts depend on classification and snapshot. It is not the Ethnologue catalog.

## Indian Census names

`india-census-languages.json` preserves the **391 named rows**, including all
**121 numbered language groups**, from the official Census 2011 table metadata:
[C-16: Population by mother tongue, India](https://censusindia.gov.in/nada/index.php/catalog/10191).
Producer: Office of the Registrar General & Census Commissioner, India.
Reference: `PC11_C16-00`. The source metadata was last modified 2022-07-04.

Extraction: first cell of each row in the "Table rows" table, excluding aggregate
"Others" rows. Original spelling and numeric prefixes remain in the data file.
Source HTML SHA-256 at download:
`956f3a20684f8fffeb6388e9254829b66bb29f16f59a670da68241842faf29c2`.

`content-languages.ts` removes numeric prefixes for display, matches identical
normalized names/aliases, and adds unmatched Census names without inventing ISO
codes. All 22 scheduled Indian languages have familiar labels and native-script
search aliases. Census groupings may span multiple ISO languages; both are kept.

## Coverage and updates

The merged picker has **8,046 selectable entries**. This is not a claim to list
every raw mother-tongue return: the reported 19,569 Census returns are not a
standardized list of distinct languages. A custom name/dialect remains valid,
and existing book language strings are preserved unless deliberately changed.

To refresh, download a new upstream ISO table, transform each row into
`{code: iso6393, name, type, scope, codes: unique nonempty iso6391/iso6392B/iso6392T excluding iso6393}`,
and regenerate the Census rows using the extraction above. Review changed names
and aliases, update counts/hashes/date here and in README, then run
`node --experimental-strip-types --test test/content-languages.test.mjs`, lint,
typecheck and the admin build. Keep the license. Catalogs are local; typing never
sends search queries to a third party.
