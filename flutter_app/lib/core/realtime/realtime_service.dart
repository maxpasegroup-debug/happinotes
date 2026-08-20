import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../network/api_client.dart';

class RealtimeService with WidgetsBindingObserver {
  RealtimeService({required this.onCatalogChanged}) {
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
    _socket.onConnect((_) => _scheduleRefresh());
    _socket.on('books:changed', (_) => _scheduleRefresh());
    _socket.connect();
  }

  final void Function() onCatalogChanged;
  late final io.Socket _socket;
  Timer? _debounce;

  bool get isConnected => _socket.connected;

  void _scheduleRefresh() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), onCatalogChanged);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (!_socket.connected) _socket.connect();
      _scheduleRefresh();
    }
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _debounce?.cancel();
    _socket.dispose();
  }
}
