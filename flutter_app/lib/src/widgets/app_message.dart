import 'package:flutter/material.dart';

class AppMessage {
  const AppMessage._();

  static final messengerKey = GlobalKey<ScaffoldMessengerState>();

  static void showGlobal(String message, {bool success = true}) {
    final messenger = messengerKey.currentState;
    if (messenger == null) return;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(_snackBar(message, success: success));
  }

  static void show(
    BuildContext context,
    String message, {
    bool success = true,
  }) {
    final messenger = ScaffoldMessenger.of(context);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(_snackBar(message, success: success));
  }

  static SnackBar _snackBar(String message, {required bool success}) => SnackBar(
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          backgroundColor: success
              ? const Color(0xFF21894A)
              : const Color(0xFFC43D3D),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          duration: const Duration(seconds: 3),
          content: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                success ? Icons.check_circle_rounded : Icons.error_rounded,
                size: 20,
                color: Colors.white,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, height: 1.2),
                ),
              ),
            ],
          ));
}
