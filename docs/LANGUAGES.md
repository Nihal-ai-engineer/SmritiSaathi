# Local interface languages

This bounded pass introduces a shared local interface catalog, not a claim of complete or clinically reviewed translation.

## Use

Select a language on the login page, or open the account circle and choose App language. The preference persists in this browser, including after sign-out. It is not synced to other devices. Account settings offer the selected region's language when a draft pack exists (Assamese for Assam, Bengali for Tripura). Other regions stay explicitly unavailable until reviewed packs are installed.

English is the fallback. Hindi coverage has been expanded; Assamese and Bengali are drafts. These are not complete whole-app translations. Runtime server errors, some dynamic labels, long guidance and some game text can still be English. The count in account settings measures the extracted catalog only, not every possible runtime message.

## Files

- `src/i18n.ts`: shared switching, fallback and browser preference.
- `src/locales/en.json`: source strings. Keys are exact English interface text.
- `src/locales/hi.json`, `as.json`, `bn.json`: available draft translations.
- `src/locales/pending/`: empty review templates for Nyishi (`njz`), Meitei (`mni`), Khasi (`kha`), Mizo (`lus`), Nagamese (`nag`) and Nepali (`ne`).

Have native speakers fill the values without changing keys. Review warnings and care instructions with appropriate language and clinical expertise. Empty values mean English fallback, not translated. Import a reviewed pack in `i18n.ts`, then extend AppLanguage, packs and languageOptions; update the unfinished-pack test when enabling it. No external translation credentials are needed for bundled files.

Only developer-authored interface strings go through `translate`. Do not pass names, captions, memories, passwords, recovery keys, API values or user messages through it. All switching is on-device. No translation service receives care data. A language choice does not change the local AI model's capabilities or install speech voices.

## Verification

`pnpm build` checks types and bundles the app. `pnpm test` includes local translation, persistence-write, fallback, unavailable-language and review-template tests. Browser refresh and account-session behavior need separate UI verification; unit tests do not replace native-speaker review.
