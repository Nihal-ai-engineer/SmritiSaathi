# SmritiSaathi · SIT313 side project

A private space to save memories, familiar people and daily reminders. The React frontend keeps the original teal care-space layout. Firebase Authentication handles accounts, and the browser reads and writes Firestore records directly.

## Run the local demo

Install Node.js 24 and Java 21 or newer. In one terminal, run:

    npm ci
    npx firebase-tools emulators:start --project demo-smritisaathi

In another terminal, run:

    VITE_USE_EMULATORS=true npm run dev -- --host 127.0.0.1 --port 5178

Open http://127.0.0.1:5178 and create a demo account. The local database starts empty unless you import emulator data. Use sample photos and notes for demonstrations.

To use an existing Firebase project, copy .env.example to .env and fill in the web app settings. Enable Email/Password sign-in and deploy the owner-only rules for the app's records before running it. Do not overwrite the rules of a Firebase project shared with another application.

## Where the code lives

| File | What it does |
| --- | --- |
| src/Auth.tsx | Register, sign in and ask for a password reset |
| src/App.tsx | Keep track of the current account, page and saved entries |
| src/RecordForm.tsx | Read the input fields and the optional photo |
| src/records.ts | Read, add, edit and remove documents in Firestore |
| firestore.rules | Limit access to the account owner and validate each entry |

Each record is stored under users/{uid}/entries/{entryId}. Firestore rules check the signed-in user's ID before permitting a read or write. Photos are optional and limited to 300 KB. The app stores them with the entry and uses Firestore access rules for privacy.

## Proposed individual demo roles

Each team member can sign in with their own demo account and walk through their assigned flow independently.

| Team member | Show live | Explain |
| --- | --- | --- |
| Naunihaljit Singh | Add a memory, save an optional photo and find the new card | A form uses React state, then saves a Firestore document |
| Yashika Gupta | Add a familiar person, then search and edit their card | The app filters entries by kind and updates the selected document |
| Sammerpreet Singh | Create a reminder with a time, mark it done and check Today | The app saves the completion date and counts today's completed reminders |
| Nikhil Sehgal | Sign in, show Today and sign out | Firebase Auth controls the session and rules separate each user's entries |

The reduced edition keeps email accounts, memories, people, reminders, search and the Today screen. The original project's custom server, encrypted vault, caregiver sharing, games, culture modules, Google login, passkeys and on-device assistant were left out of this edition. Firebase access control replaces the vault in this edition. Data from the earlier application is not migrated.
