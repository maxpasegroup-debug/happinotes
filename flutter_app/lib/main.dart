import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/providers.dart';
import 'src/screens/auth_screen.dart';
import 'src/screens/launch_splash.dart';
import 'src/screens/main_shell.dart';
import 'src/screens/admin_screen.dart';
import 'src/theme.dart';

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
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'HappiNotes',
      theme: buildHappiTheme(),
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
