import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../../firebase_options.dart';
import '../../src/widgets/app_message.dart';
import '../network/api_client.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
}

class FcmService {
  FcmService(this._client);

  final ApiClient _client;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _messageSubscription;
  Future<void>? _initialization;
  bool _initialized = false;

  Future<void> initialize() {
    if (_initialized) return Future<void>.value();
    return _initialization ??= _initialize();
  }

  Future<void> _initialize() async {
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) await _registerToken(token);

      _tokenSubscription = messaging.onTokenRefresh.listen(_registerToken);
      _messageSubscription = FirebaseMessaging.onMessage.listen(_showForegroundMessage);
      _initialized = true;
    } catch (error) {
      // Notifications must never prevent the app from opening or logging in.
      _initialization = null;
    }
  }

  Future<void> _registerToken(String token) async {
    try {
      await _client.dio.post('/auth/me/fcm-token', data: {'token': token});
    } catch (_) {
      // The next token refresh or app launch will retry registration.
    }
  }

  void _showForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    final title = notification?.title?.trim() ?? '';
    final body = notification?.body?.trim() ?? '';
    final text = [title, body].where((value) => value.isNotEmpty).join('\n');
    if (text.isNotEmpty) AppMessage.showGlobal(text);
  }

  Future<void> dispose() async {
    await _tokenSubscription?.cancel();
    await _messageSubscription?.cancel();
    _tokenSubscription = null;
    _messageSubscription = null;
  }
}
