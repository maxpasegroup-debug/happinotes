import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../network/api_client.dart';

class RealtimeService with WidgetsBindingObserver {
  RealtimeService({
    required this.onCatalogChanged,
    required this.onSubscriptionPlansChanged,
  }) {
    WidgetsBinding.instance.addObserver(this);
    final serverUrl = ApiClient.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    _socket = io.io(
      serverUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .enableReconnection()
          .build(),
    );
    _socket.onConnect((_) {
      _scheduleRefresh();
      _scheduleSubscriptionRefresh();
    });
    _socket.on('books:changed', (_) => _scheduleRefresh());
    _socket.on('subscription-plans:changed', (_) => _scheduleSubscriptionRefresh());
    _socket.connect();
  }

  final void Function() onCatalogChanged;
  final void Function() onSubscriptionPlansChanged;
  late final io.Socket _socket;
  Timer? _debounce;
  Timer? _subscriptionDebounce;

  bool get isConnected => _socket.connected;

  void _scheduleRefresh() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), onCatalogChanged);
  }

  void _scheduleSubscriptionRefresh() {
    _subscriptionDebounce?.cancel();
    _subscriptionDebounce = Timer(
      const Duration(milliseconds: 300),
      onSubscriptionPlansChanged,
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (!_socket.connected) _socket.connect();
      _scheduleRefresh();
      _scheduleSubscriptionRefresh();
    }
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _debounce?.cancel();
    _subscriptionDebounce?.cancel();
    _socket.dispose();
  }
}
