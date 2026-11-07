# Northeast-first care experience

The regional experience is a core part of SmritiSaathi, not an opt-in module. New and existing care profiles must select one of the eight Northeastern states and enter their own cultural language before the main app opens. The owner can change these choices in Care & privacy. The regional navigation item remains visible.

Supported state choices: Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim and Tripura. State choice does not assume ethnicity, language, music preference or religion. The user/caregiver supplies the recordings and learn-first/recall-later prompts.

Music: user-supplied MP3/WAV/M4A/OGG/WebM, 20 MB per recording and 20 recordings per profile on this browser. Metadata and audio are encrypted with the care profile key in IndexedDB. Playback requires a deliberate action. Music is filtered by the selected region and does not sync between devices. Keep original recordings. Browser storage cleanup removes local copies. No licensed catalogue or generated music is bundled.

Activities: caregiver/user-authored question and familiar answer, encrypted through the existing health-record API. Region filtering occurs after browser decryption. Learn, recall and reveal are not clinical assessments. The region is mandatory; participation in individual activities is always the person's choice. Currently activities are drawn from the loaded health-record page, not the entire history.

Caregiver calling: a separate encrypted name/phone preference, exposed through the Today screen. The button shows the contact before opening a tel: link. The operating system handles the call and confirmation; the app does not call automatically, provide emergency dispatch, or monitor calls. Desktop use requires a configured calling application.

Language boundary: cultural-language choice labels the user's own material. It does not claim translated UI, speech recognition or Bhashini integration for that language. Existing English/Hindi support remains partial. The supplied Bhashini screenshots are reference material, not verified API specifications or credentials. Additional regional UI translations need language-reviewed local dictionaries before being advertised as supported. No care content is sent to a translation API.

Verification: TypeScript/Vite build and existing backend/crypto regression suite run after these changes. Audio playback, browser-storage persistence, region-switching and phone dialler need browser/physical-device acceptance checks; do not treat the build alone as proof of those end-to-end behaviours.
