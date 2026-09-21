import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:happinotes_flutter/features/auth/domain/entities/user.dart';
import 'package:happinotes_flutter/features/auth/domain/repositories/auth_repository.dart';
import 'package:happinotes_flutter/features/auth/presentation/controllers/session_controller.dart';
import 'package:happinotes_flutter/src/screens/launch_splash.dart';

class _StartupRepository implements AuthRepository {
  _StartupRepository(this.restore);
  final Future<User?> Function() restore;

  @override
  Future<User?> restoreSession() => restore();

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  testWidgets('storage failure finishes startup as signed out', (tester) async {
    final controller = SessionController(
      _StartupRepository(() async => throw PlatformException(code: 'storage')),
    );
    addTearDown(controller.dispose);
    var notifications = 0;
    controller.addListener(() => notifications++);

    final startup = controller.initialize();
    await tester.pump(const Duration(milliseconds: 1700));
    await startup;

    expect(controller.initialized, isTrue);
    expect(controller.isLoggedIn, isFalse);
    expect(notifications, 1);
  });

  testWidgets('startup waits for session restoration', (tester) async {
    final restore = Completer<User?>();
    final controller = SessionController(
      _StartupRepository(() => restore.future),
    );
    addTearDown(controller.dispose);
    final startup = controller.initialize();
    await tester.pump(const Duration(seconds: 2));
    expect(controller.initialized, isFalse);
    restore.complete(null);
    await startup;
    expect(controller.initialized, isTrue);
  });

  testWidgets('disposing during startup does not notify after disposal', (
    tester,
  ) async {
    final controller = SessionController(_StartupRepository(() async => null));
    final startup = controller.initialize();
    controller.dispose();
    await tester.pump(const Duration(milliseconds: 1700));
    await startup;
    expect(tester.takeException(), isNull);
  });

  testWidgets('splash fits a short screen with large text', (tester) async {
    tester.view.physicalSize = const Size(320, 320);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      const MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(
            size: Size(320, 320),
            textScaler: TextScaler.linear(2),
            disableAnimations: true,
          ),
          child: LaunchSplash(),
        ),
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(
      tester
          .widget<FadeTransition>(
            find.descendant(
              of: find.byType(LaunchSplash),
              matching: find.byType(FadeTransition),
            ),
          )
          .opacity
          .value,
      1,
    );
    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.takeException(), isNull);
  });
}
