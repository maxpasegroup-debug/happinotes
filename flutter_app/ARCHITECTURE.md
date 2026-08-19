# Flutter architecture

The Flutter client uses feature-first Clean Architecture.

## Dependency direction

`presentation -> domain <- data`

- `lib/core`: shared infrastructure such as the authenticated HTTP client.
- `lib/features/*/domain`: framework-independent entities and repository contracts.
- `lib/features/*/data`: API models and repository implementations.
- `lib/features/*/presentation`: focused `ChangeNotifier` controllers for UI state.
- `lib/src/screens` and `lib/src/widgets`: application presentation/composition. These depend on domain entities and presentation controllers, never concrete data repositories.
- `lib/app/providers.dart`: Riverpod dependency graph for the API client, repositories, and feature controllers.
- `lib/main.dart`: composition root containing the global Riverpod `ProviderScope`.

## Features

- `auth`: session restoration, OTP/PIN login, language preference, logout.
- `books`: catalog entities, API repository, loading/search state.
- `player`: audio playback state isolated from catalog and authentication.
- `membership`: plans, order creation, and payment verification.

Repository interfaces live in the domain layer. Concrete Dio-backed implementations remain in the data layer. Widgets do not call Dio directly. Screens use `ref.watch` for reactive state and `ref.read` for commands; `BuildContext` is never used as a service locator.
