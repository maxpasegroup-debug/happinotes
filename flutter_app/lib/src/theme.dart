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

ThemeData buildHappiTheme() => ThemeData(
  brightness: Brightness.dark,
  scaffoldBackgroundColor: AppColors.background,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AppColors.coral,
    brightness: Brightness.dark,
    surface: AppColors.surface,
  ),
  useMaterial3: true,
  textTheme: const TextTheme(
    headlineMedium: TextStyle(
      color: AppColors.text,
      fontWeight: FontWeight.w800,
    ),
    titleLarge: TextStyle(color: AppColors.text, fontWeight: FontWeight.w800),
    titleMedium: TextStyle(color: AppColors.text, fontWeight: FontWeight.w700),
    bodyMedium: TextStyle(color: AppColors.text),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: AppColors.raised,
    hintStyle: const TextStyle(color: AppColors.muted),
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
