import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/providers.dart';
import 'features/auth/presentation/controllers/session_controller.dart';
import 'src/screens/auth_screen.dart';
import 'src/screens/launch_splash.dart';
import 'src/screens/main_shell.dart';
import 'src/screens/admin_screen.dart';
import 'src/screens/membership_screen.dart';
import 'src/theme.dart';
import 'src/widgets/app_message.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: HappiNotesApp()));
}

class HappiNotesApp extends ConsumerStatefulWidget {
  const HappiNotesApp({super.key});

  @override
  ConsumerState<HappiNotesApp> createState() => _HappiNotesAppState();
}

class _HappiNotesAppState extends ConsumerState<HappiNotesApp> {
  final _navigatorKey = GlobalKey<NavigatorState>();
  bool _initialSessionResolved = false;
  bool _previouslyLoggedIn = false;
  bool _showingPlans = false;

  void _showPlansAfterLogin(SessionController session) {
    if (_showingPlans || session.user?.role == 'admin') return;
    _showingPlans = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final navigator = _navigatorKey.currentState;
      if (navigator == null || !mounted) {
        _showingPlans = false;
        return;
      }
      await navigator.push(
        MaterialPageRoute(builder: (_) => const MembershipScreen()),
      );
      _showingPlans = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(realtimeServiceProvider);
    final state = ref.watch(sessionControllerProvider);
    if (state.initialized) {
      if (_initialSessionResolved && !_previouslyLoggedIn && state.isLoggedIn) {
        _showPlansAfterLogin(state);
      }
      _initialSessionResolved = true;
    }
    _previouslyLoggedIn = state.isLoggedIn;
    return MaterialApp(
      navigatorKey: _navigatorKey,
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: AppMessage.messengerKey,
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
