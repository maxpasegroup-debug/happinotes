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
    final theme = ref.watch(themeControllerProvider);
    ref.listen(sessionControllerProvider, (previous, next) {
      // Never reopen the app on a stale tab from the previous session.
      if (next.user == null || previous?.user == null) {
        ref.read(mainTabIndexProvider.notifier).state = 0;
      }
      if (next.user != null && previous?.user == null) {
        // Start the feed request as soon as a saved session is restored,
        // while LaunchSplash is still on screen.
        ref.read(booksControllerProvider).loadBooks();
        if (next.user?.role != 'admin') {
          ref.read(booksControllerProvider).loadCollection();
        }
      }
    });
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: AppMessage.messengerKey,
      title: 'HappiNotes',
      theme: buildHappiTheme(),
      darkTheme: buildHappiTheme(Brightness.dark),
      themeMode: theme.mode,
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
