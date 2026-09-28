import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/auth/presentation/controllers/auth_form_controller.dart';
import '../theme.dart';
import '../widgets/app_message.dart';
import 'forgot_pin_screen.dart';

class AuthScreen extends ConsumerWidget {
  const AuthScreen({super.key});

  Future<void> _submit(WidgetRef ref) async {
    final form = ref.read(authFormControllerProvider);
    await form.submit();
    if (form.successMessage != null || form.error != null) {
      AppMessage.showGlobal(form.successMessage ?? form.error!, success: form.successMessage != null);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final form = ref.watch(authFormControllerProvider);
    final heading = switch (form.step) {
      AuthStep.email => form.isSignup ? 'Create your account' : 'Welcome back',
      AuthStep.otp => 'Verify your email',
      AuthStep.password => 'Enter your password',
    };
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Image.asset('assets/images/happinotes-logo.png', height: 140),
                Text(heading, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 28),
                if (form.step == AuthStep.email)
                  TextFormField(
                    initialValue: form.email,
                    onChanged: form.setEmail,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(labelText: 'Email address', prefixIcon: Icon(Icons.email_outlined)),
                  ),
                if (form.step == AuthStep.otp) ...[
                  Text('We sent a 6-digit code to ${form.email}', textAlign: TextAlign.center),
                  const SizedBox(height: 14),
                  if (form.testOtp != null) Text('DEMO OTP: ${form.testOtp}', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.coral, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  TextFormField(
                    initialValue: form.otp,
                    onChanged: form.setOtp,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    textAlign: TextAlign.center,
                    decoration: const InputDecoration(labelText: 'Email verification code', prefixIcon: Icon(Icons.verified_outlined), counterText: ''),
                  ),
                ],
                if (form.step == AuthStep.password) ...[
                  if (form.isSignup) ...[
                    TextFormField(initialValue: form.name, onChanged: form.setName, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.person_outline_rounded))),
                    const SizedBox(height: 14),
                  ],
                  _PasswordField(label: 'Password', value: form.password, onChanged: form.setPassword),
                  if (form.isSignup) ...[
                    const SizedBox(height: 14),
                    _PasswordField(label: 'Confirm password', value: form.confirmPassword, onChanged: form.setConfirmPassword),
                  ],
                ],
                if (form.error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(form.error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.redAccent))),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: form.loading ? null : () => _submit(ref),
                  style: FilledButton.styleFrom(backgroundColor: AppColors.coral, padding: const EdgeInsets.all(17)),
                  child: Text(form.loading ? 'Please wait...' : form.step == AuthStep.email ? 'Continue' : form.step == AuthStep.otp ? 'Verify email' : form.isSignup ? 'Create account' : 'Sign in'),
                ),
                if (form.step != AuthStep.email) TextButton(onPressed: form.loading ? null : form.changeEmail, child: const Text('Change email')),
                if (form.step == AuthStep.email) ...[
                  TextButton(onPressed: form.loading ? null : form.toggleMode, child: Text(form.isSignup ? 'Already have an account? Sign in' : 'New to HappiNotes? Create account')),
                  if (!form.isSignup) TextButton(onPressed: form.loading ? null : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ForgotPinScreen())), child: const Text('Forgot password?')),
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _PasswordField extends StatefulWidget {
  const _PasswordField({required this.label, required this.value, required this.onChanged});
  final String label, value;
  final ValueChanged<String> onChanged;
  @override
  State<_PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<_PasswordField> {
  bool hidden = true;
  @override
  Widget build(BuildContext context) => TextFormField(
    initialValue: widget.value,
    onChanged: widget.onChanged,
    obscureText: hidden,
    decoration: InputDecoration(
      labelText: widget.label,
      prefixIcon: const Icon(Icons.lock_outline_rounded),
      suffixIcon: IconButton(tooltip: hidden ? 'Show password' : 'Hide password', icon: Icon(hidden ? Icons.visibility_off_rounded : Icons.visibility_rounded), onPressed: () => setState(() => hidden = !hidden)),
    ),
  );
}
