import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeController extends ChangeNotifier {
  static const _storageKey = 'theme_mode';
  ThemeMode _mode = ThemeMode.dark;
  bool _initialized = false;

  ThemeMode get mode => _mode;
  bool get initialized => _initialized;

  Future<void> initialize() async {
    if (_initialized) return;
    final preferences = await SharedPreferences.getInstance();
    final stored = preferences.getString(_storageKey);
    if (stored == 'light') _mode = ThemeMode.light;
    if (stored == 'system') _mode = ThemeMode.system;
    _initialized = true;
    notifyListeners();
  }

  Future<void> setMode(ThemeMode mode) async {
    _mode = mode;
    notifyListeners();
    final value = switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    };
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_storageKey, value);
  }

  Future<void> toggle() => setMode(_mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
}
