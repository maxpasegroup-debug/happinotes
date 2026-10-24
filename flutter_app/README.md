# HappiNotes Flutter app

## API environment

Every run or build must provide `API_BASE_URL` with Flutter's compile-time
`--dart-define` option. The app does not contain a production URL fallback.

- Debug/profile builds require an explicit development URL. HTTPS is accepted
  for a development server; plain HTTP is accepted only for local/emulator
  hosts. Remote HTTPS hosts must have a `dev`, `development`, `test`,
  `testing`, `staging`, or `sandbox` label. Production-looking hosts and the
  known HappiNotes production Railway host are rejected in non-release builds.
- Release builds require an explicitly supplied HTTPS API origin. The
  validator rejects credentials, path, query and fragment components.
- `API_BASE_URL` is an address, not a secret. Never put server credentials,
  provider keys or other secrets in a Flutter define.

## Local development

From `flutter_app/`, for a local backend on an Android emulator:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000
```

For an iOS simulator or a local desktop run, use the appropriate local host,
for example:

```powershell
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:5000
```

If the development backend is hosted, pass its HTTPS origin explicitly. Do not
use the production backend for development or test builds.

## Tests and analysis

The API URL validator tests use explicit URLs and do not contact a backend.
Purchase tests use mocked stores and HTTP adapters.

```powershell
flutter analyze
flutter test
```

## Release compilation

Only when preparing an intentional release, supply the owner-confirmed
production API origin explicitly. Use placeholders in local examples and do
not run this command against production as a test:

```powershell
$apiOrigin = Read-Host 'Enter the owner-confirmed production API origin'
flutter build appbundle --release --dart-define="API_BASE_URL=$apiOrigin"
```

For iOS release compilation, use the same deliberate configuration with:

```powershell
flutter build ipa --release --dart-define="API_BASE_URL=$apiOrigin"
```

A missing release URL fails the Dart compile-time guard; a malformed or
insecure URL fails the API client validator before a request can be sent. An
iOS subscription product is not offered until its App Store product
identifier is configured by the backend owner.
