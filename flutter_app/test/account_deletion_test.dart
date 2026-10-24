import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:happinotes_flutter/app/providers.dart';
import 'package:happinotes_flutter/core/network/api_client.dart';
import 'package:happinotes_flutter/features/auth/domain/entities/account_deletion.dart';
import 'package:happinotes_flutter/features/auth/domain/entities/user.dart';
import 'package:happinotes_flutter/features/auth/domain/repositories/auth_repository.dart';
import 'package:happinotes_flutter/features/auth/presentation/controllers/session_controller.dart';
import 'package:happinotes_flutter/src/screens/account_deletion_screen.dart';
import 'package:happinotes_flutter/src/theme.dart';

class _FakeDeletionRepository implements AuthRepository {
  _FakeDeletionRepository({this.status, this.statusError});

  AccountDeletionRequestStatus? status;
  Object? statusError;
  Object? reauthError;
  Object? requestError;
  int requestCount = 0;
  bool loggedOut = false;

  @override
  Future<User?> restoreSession() async => null;

  @override
  Future<DeletionReauthProof> requestDeletionReauth(String credential) async {
    if (reauthError != null) throw reauthError!;
    return const DeletionReauthProof(proof: 'proof-from-server');
  }

  @override
  Future<AccountDeletionRequestStatus> requestAccountDeletion({
    required String proof,
    required String idempotencyKey,
  }) async {
    requestCount++;
    if (requestError != null) throw requestError!;
    return status ??
        const AccountDeletionRequestStatus(
          requestId: 'request-1',
          status: AccountDeletionStatus.requested,
        );
  }

  @override
  Future<AccountDeletionRequestStatus> getAccountDeletionStatus() async {
    if (statusError != null) throw statusError!;
    return status!;
  }

  @override
  Future<void> logout() async {
    loggedOut = true;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

final _user = const User(id: 'user-1', name: 'Listener', role: 'user');

DioException _deletionNotFound() => DioException(
  requestOptions: RequestOptions(path: '/auth/me/deletion-request'),
  response: Response(
    requestOptions: RequestOptions(path: '/auth/me/deletion-request'),
    statusCode: 401,
    data: {'message': 'Deletion request not found'},
  ),
);

DioException _serverError(String message) => DioException(
  requestOptions: RequestOptions(path: '/auth/me/deletion-request'),
  response: Response(
    requestOptions: RequestOptions(path: '/auth/me/deletion-request'),
    statusCode: 503,
    data: {'message': message},
  ),
);

DioException _networkError() => DioException(
  requestOptions: RequestOptions(path: '/auth/me/deletion-request'),
  type: DioExceptionType.connectionError,
  message: 'offline',
);

DioException _sessionExpired() => DioException(
  requestOptions: RequestOptions(path: '/auth/me/deletion-request'),
  response: Response(
    requestOptions: RequestOptions(path: '/auth/me/deletion-request'),
    statusCode: 401,
    data: {'message': 'Invalid or expired token'},
  ),
);

Widget _app(_FakeDeletionRepository repository) {
  final session = SessionController(repository)..user = _user;
  return ProviderScope(
    key: ValueKey(repository),
    overrides: [
      sessionControllerProvider.overrideWith((ref) => session),
      apiClientProvider.overrideWithValue(
        ApiClient(apiBaseUrl: 'http://127.0.0.1:5000', releaseBuild: false),
      ),
    ],
    child: MaterialApp(
      theme: buildHappiTheme(),
      home: AccountDeletionScreen(key: ValueKey(repository)),
    ),
  );
}

void main() {
  test('status model handles backend states without inventing success', () {
    final blocked = AccountDeletionRequestStatus.fromJson({
      'requestId': 'opaque',
      'status': 'blocked_policy',
      'failureCode': 'POLICY_APPROVAL_REQUIRED',
    });
    expect(blocked.status, AccountDeletionStatus.blockedPolicy);
    expect(blocked.isPending, isTrue);
    expect(
      AccountDeletionRequestStatus.fromJson({'status': 'future_state'}).status,
      AccountDeletionStatus.unknown,
    );
  });

  testWidgets('no request shows the explicit account deletion action', (
    tester,
  ) async {
    final repository = _FakeDeletionRepository(
      statusError: _deletionNotFound(),
    );
    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();
    expect(find.text('Start account deletion'), findsOneWidget);
    expect(find.text('Open Premium subscription'), findsOneWidget);
  });

  testWidgets('confirmation and reauthentication submit one request', (
    tester,
  ) async {
    final repository = _FakeDeletionRepository(
      statusError: _deletionNotFound(),
    );
    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Start account deletion'));
    await tester.pumpAndSettle();
    expect(find.text('Delete your account?'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'secret1');
    await tester.pump();
    await tester.tap(find.text('Verify'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Final confirmation'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Delete account'));
    await tester.pumpAndSettle();

    expect(repository.requestCount, 1);
    expect(find.text('Deletion request received'), findsOneWidget);
    expect(find.textContaining('check again'), findsOneWidget);
  });

  testWidgets(
    'pending and blocked policy states do not show another delete action',
    (tester) async {
      for (final status in [
        AccountDeletionStatus.processing,
        AccountDeletionStatus.blockedPolicy,
      ]) {
        final repository = _FakeDeletionRepository(
          status: AccountDeletionRequestStatus(
            requestId: 'request',
            status: status,
          ),
        );
        await tester.pumpWidget(_app(repository));
        await tester.pumpAndSettle();
        expect(find.text('Start account deletion'), findsNothing);
        expect(
          find.text(
            status == AccountDeletionStatus.processing
                ? 'Deletion is processing'
                : 'Deletion is temporarily paused',
          ),
          findsOneWidget,
        );
      }
    },
  );

  testWidgets('request failure is shown without claiming deletion succeeded', (
    tester,
  ) async {
    final repository = _FakeDeletionRepository(statusError: _deletionNotFound())
      ..requestError = _serverError('Deletion service unavailable');
    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start account deletion'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'secret1');
    await tester.pump();
    await tester.tap(find.text('Verify'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.widgetWithText(FilledButton, 'Delete account'));
    await tester.pumpAndSettle();

    expect(repository.requestCount, 1);
    expect(find.text('Deletion request received'), findsNothing);
    expect(find.textContaining('Deletion service unavailable'), findsOneWidget);
    expect(find.text('Retry deletion request'), findsOneWidget);
  });

  testWidgets('network failure preserves a safe retry path', (tester) async {
    final repository = _FakeDeletionRepository(statusError: _deletionNotFound())
      ..requestError = _networkError();
    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start account deletion'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'secret1');
    await tester.pump();
    await tester.tap(find.text('Verify'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.widgetWithText(FilledButton, 'Delete account'));
    await tester.pumpAndSettle();

    expect(find.text('Retry deletion request'), findsOneWidget);
    expect(find.textContaining('Cannot reach the backend'), findsOneWidget);
  });

  testWidgets('expired sessions are cleared without claiming deletion', (
    tester,
  ) async {
    final repository = _FakeDeletionRepository(statusError: _sessionExpired());
    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();
    expect(repository.loggedOut, isTrue);
    expect(find.text('Start account deletion'), findsOneWidget);
  });
}
