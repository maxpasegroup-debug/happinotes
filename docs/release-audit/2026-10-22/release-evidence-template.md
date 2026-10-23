# HappiNotes release evidence template

Copy this file for each candidate. Do not record private keys, service-account JSON, purchase tokens, JWTs, passwords, or full personal data.

## Candidate identity

- Date/time/time zone:
- Git commit SHA:
- Branch/tag:
- Worktree clean (yes/no):
- Flutter/Dart version:
- Node/npm version:
- Backend deployment service + commit SHA:
- Admin deployment service + commit SHA:
- API health URL/status:
- Android package/application ID:
- Version name:
- Version code:
- AAB path (local only):
- AAB SHA-256:
- AAB size:
- Effective target SDK:
- Upload certificate SHA-256 (public fingerprint):
- Play app-signing certificate SHA-256 (public fingerprint):

## Automated checks

| Command | Environment | Exit code | Result/counts | Evidence link/log |
|---|---|---:|---|---|
| `flutter test` | | | | |
| `flutter analyze` | | | | |
| `flutter build appbundle --release` | | | | |
| `backend npm run build` | | | | |
| `backend npm test` | | | | |
| `backend npm run lint` | | | | |
| `admin npx tsc --noEmit` | | | | |
| `admin npm run lint` | | | | |
| `admin npm run build` | | | | |

## Manual device matrix

| Device/OS | Play track/build source | Account type | Scenario | Expected | Actual | Pass/fail |
|---|---|---|---|---|---|---|
| | | | Fresh install/login | | | |
| | | | Email/OTP recovery | | | |
| | | | Free content/playback | | | |
| | | | Monthly subscription | | | |
| | | | Yearly subscription | | | |
| | | | Pending/restore/renewal | | | |
| | | | Cancellation/expiry/refund | | | |
| | | | Account switch/replay protection | | | |
| | | | FCM foreground/background/tap | | | |
| | | | In-app notification/image/deep link | | | |
| | | | Admin new/coming-soon book | | | |
| | | | Admin new episode | | | |
| | | | Cloudinary cover/audio upload | | | |
| | | | Offline/timeout/retry | | | |

## Play Console evidence

- Track and release:
- Opt-in URL:
- Tester accounts (aliases only):
- Product IDs/base plans:
- Product availability/regions:
- Acknowledgement/refund evidence:
- Pre-launch report:
- Data Safety status:
- Account deletion URL and in-app path:
- Privacy policy URL:
- Release notes:

## Open risks and sign-off

| ID | Priority | Description | Owner | Mitigation/acceptance | Due date | Status |
|---|---|---|---|---|---|---|
| | | | | | | |

Release decision: `NOT READY / INTERNAL TEST ONLY / READY FOR PRODUCTION`  
Decision owner:  
Date:  
Notes:

