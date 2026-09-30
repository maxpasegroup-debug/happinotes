import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/providers.dart';
import 'src/screens/auth_screen.dart';
import 'src/screens/launch_splash.dart';
import 'src/screens/main_shell.dart';
import 'src/screens/admin_screen.dart';
import 'src/theme.dart';
import 'src/widgets/app_message.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: HappiNotesApp()));
}

class HappiNotesApp extends ConsumerWidget {
  const HappiNotesApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(realtimeServiceProvider);
    final state = ref.watch(sessionControllerProvider);
    final books = ref.watch(booksControllerProvider);
    final theme = ref.watch(themeControllerProvider);
    if (state.initialized && state.isLoggedIn) {
      Future.microtask(() => ref.read(fcmServiceProvider).initialize());
    }
    if (state.initialized && state.isLoggedIn && !books.hasLoaded && !books.loading) {
      Future.microtask(() => ref.read(booksControllerProvider).loadBooks());
    }
    ref.listen(sessionControllerProvider, (previous, next) {
      // Never reopen the app on a stale tab from the previous session.
      if (next.user == null || previous?.user == null) {
        ref.read(mainTabIndexProvider.notifier).state = 0;
      }
      if (next.user != null && !next.initialized) {
        // ChangeNotifier providers may deliver the same controller instance
        // as both `previous` and `next`, so comparing previous.user is not
        // reliable here. During restore, initialized is still false; start
        // the feed requests then while LaunchSplash is still on screen.
        ref.read(booksControllerProvider).loadBooks();
        if (next.user?.role != 'admin') {
          ref.read(booksControllerProvider).loadCollection();
        }
      }
    });
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      color: const Color(0xFFFFF8EC),
      scaffoldMessengerKey: AppMessage.messengerKey,
      title: 'HappiNotes',
      theme: buildHappiTheme(),
      darkTheme: buildHappiTheme(Brightness.dark),
      themeMode: theme.mode,
      // The branded splash is only responsible for restoring the session.
      // Catalog requests continue in the background; keeping the whole app on
      // the splash until a network request finishes can look like a hang on a
      // slow/offline connection. Home renders its loading skeleton instead.
      home: !state.initialized
          ? const LaunchSplash()
          : state.isLoggedIn
          ? state.user?.role == 'admin'
                ? const AdminScreen()
                : const MainShell()
          : const AuthScreen(),
    );
  }
}
