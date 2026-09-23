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
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.coral,
    brightness: brightness,
    surface: surface,
  ).copyWith(
    surfaceContainerLowest: background,
    surfaceContainerLow: surface,
    surfaceContainer: raised,
    surfaceContainerHigh: raised,
    onSurface: text,
    onSurfaceVariant: muted,
    outline: dark ? const Color(0xFF4A4542) : const Color(0xFFD9D0C8),
  );
  return ThemeData(
    brightness: brightness,
    scaffoldBackgroundColor: background,
    colorScheme: scheme,
    useMaterial3: true,
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      foregroundColor: text,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: text,
        fontSize: 20,
        fontWeight: FontWeight.w800,
      ),
    ),
    textTheme: TextTheme(
      displaySmall: TextStyle(color: text, fontWeight: FontWeight.w900),
      headlineMedium: TextStyle(color: text, fontWeight: FontWeight.w800),
      headlineSmall: TextStyle(color: text, fontWeight: FontWeight.w800),
      titleLarge: TextStyle(color: text, fontWeight: FontWeight.w800),
      titleMedium: TextStyle(color: text, fontWeight: FontWeight.w700),
      bodyLarge: TextStyle(color: text, height: 1.35),
      bodyMedium: TextStyle(color: text, height: 1.35),
      bodySmall: TextStyle(color: muted, height: 1.3),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: raised,
      hintStyle: TextStyle(color: muted),
      labelStyle: TextStyle(color: muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: scheme.outline.withValues(alpha: .45)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.coral, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colors.redAccent),
      ),
    ),
    cardTheme: CardThemeData(
      color: surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: scheme.outline.withValues(alpha: .35)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.coral,
        foregroundColor: Colors.white,
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 50),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
        side: BorderSide(color: scheme.outline),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      indicatorColor: AppColors.coral.withValues(alpha: .16),
      height: 72,
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(fontSize: 12, color: text, fontWeight: FontWeight.w700),
      ),
    ),
    dividerTheme: DividerThemeData(
      color: scheme.outline.withValues(alpha: .45),
      space: 1,
      thickness: 1,
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
