import 'package:flutter/material.dart';

abstract final class AppColors {
  static const background = Color(0xFF111111),
      surface = Color(0xFF1B1B1B),
      raised = Color(0xFF242424),
      coral = Color(0xFFF25F45),
      saffron = Color(0xFFF6B91A),
      text = Color(0xFFF8F5F0),
      muted = Color(0xFFA8A29E),
      success = Color(0xFF16803C);
}

ThemeData buildHappiTheme([Brightness brightness = Brightness.light]) {
  final dark = brightness == Brightness.dark;
  final background = dark ? AppColors.background : const Color(0xFFFFFBF7);
  final surface = dark ? AppColors.surface : Colors.white;
  final raised = dark ? AppColors.raised : const Color(0xFFF3EDE7);
  final text = dark ? AppColors.text : const Color(0xFF241F1C);
  final muted = dark ? AppColors.muted : const Color(0xFF6B625C);
  return ThemeData(
  brightness: brightness,
  scaffoldBackgroundColor: background,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AppColors.coral,
    brightness: brightness,
    surface: surface,
  ),
  useMaterial3: true,
  textTheme: TextTheme(
    headlineMedium: TextStyle(
      color: text,
      fontWeight: FontWeight.w800,
    ),
    titleLarge: TextStyle(color: text, fontWeight: FontWeight.w800),
    titleMedium: TextStyle(color: text, fontWeight: FontWeight.w700),
    bodyMedium: TextStyle(color: text),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: raised,
    hintStyle: TextStyle(color: muted),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide.none,
    ),
  ),
  snackBarTheme: const SnackBarThemeData(
    backgroundColor: AppColors.success,
    contentTextStyle: TextStyle(
      color: Colors.white,
      fontWeight: FontWeight.w700,
    ),
    behavior: SnackBarBehavior.floating,
  ),
  );
}
