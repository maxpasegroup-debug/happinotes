import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../theme.dart';
import '../widgets/app_message.dart';

/// Password recovery screen. The legacy filename is kept so existing routes
/// remain valid, but recovery now uses the account email and password.
class ForgotPinScreen extends ConsumerStatefulWidget {
  const ForgotPinScreen({super.key});

  @override
  ConsumerState<ForgotPinScreen> createState() => _ForgotPinScreenState();
}

class _ForgotPinScreenState extends ConsumerState<ForgotPinScreen> {
  final email = TextEditingController();
  final otp = TextEditingController();
  final password = TextEditingController();
  bool sent = false;
  bool loading = false;
  bool hidden = true;
  String? error;

  @override
  void dispose() {
    email.dispose();
    otp.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { loading = true; error = null; });
    try {
      final repository = ref.read(authRepositoryProvider);
      if (!sent) {
        if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email.text.trim())) {
          throw StateError('Enter a valid email address.');
        }
        await repository.requestPasswordReset(email.text);
        sent = true;
      } else {
        if (!RegExp(r'^\d{6}$').hasMatch(otp.text)) {
          throw StateError('Enter the 6-digit OTP.');
        }
        if (password.text.length < 6) {
          throw StateError('Password must be at least 6 characters.');
        }
        await repository.resetPassword(email: email.text, otp: otp.text, newPassword: password.text);
        if (mounted) {
          AppMessage.showGlobal('Password reset successfully. You can sign in now.', success: true);
          Navigator.of(context).pop();
          return;
        }
      }
    } catch (e) {
      error = ref.read(apiClientProvider).errorMessage(e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Forgot password')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text('Reset your password', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        const Text('Enter your email address to receive a reset code.'),
        const SizedBox(height: 24),
        TextField(
          controller: email,
          enabled: !sent,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Email address', prefixIcon: Icon(Icons.email_outlined)),
        ),
        if (sent) ...[
          const SizedBox(height: 14),
          TextField(
            controller: otp,
            keyboardType: TextInputType.number,
            maxLength: 6,
            decoration: const InputDecoration(labelText: 'Verification code', prefixIcon: Icon(Icons.verified_outlined)),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: password,
            obscureText: hidden,
            decoration: InputDecoration(
              labelText: 'New password',
              prefixIcon: const Icon(Icons.lock_outline_rounded),
              suffixIcon: IconButton(
                tooltip: hidden ? 'Show password' : 'Hide password',
                icon: Icon(hidden ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                onPressed: () => setState(() => hidden = !hidden),
              ),
            ),
          ),
        ],
        if (error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(error!, style: const TextStyle(color: Colors.redAccent))),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: loading ? null : _submit,
          style: FilledButton.styleFrom(backgroundColor: AppColors.coral, padding: const EdgeInsets.all(17)),
          child: Text(loading ? 'Please wait...' : sent ? 'Reset password' : 'Send reset code'),
        ),
      ],
    ),
  );
}
