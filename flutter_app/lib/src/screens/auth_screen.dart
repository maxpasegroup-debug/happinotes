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
                    decoration: InputDecoration(
                      labelText: 'Email address',
                      prefixIcon: const Icon(Icons.email_outlined),
                      errorText: form.email.isNotEmpty &&
                              !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(form.email)
                          ? 'Enter a valid email address'
                          : null,
                    ),
                  ),
                if (form.step == AuthStep.otp) ...[
                  Text('We sent a 6-digit code to ${form.email}', textAlign: TextAlign.center),
                  const SizedBox(height: 14),
                  if (form.testOtp != null) Text('DEMO OTP: ${form.testOtp}', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.coral, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  OtpBoxes(value: form.otp, onChanged: form.setOtp, enabled: !form.loading, onCompleted: () => _submit(ref)),
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

class OtpBoxes extends StatefulWidget {
  const OtpBoxes({super.key, required this.value, required this.onChanged, required this.enabled, this.onCompleted});
  final String value;
  final ValueChanged<String> onChanged;
  final bool enabled;
  final VoidCallback? onCompleted;

  @override
  State<OtpBoxes> createState() => _OtpBoxesState();
}

class _OtpBoxesState extends State<OtpBoxes> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _nodes;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(6, (i) => TextEditingController(text: i < widget.value.length ? widget.value[i] : ''));
    _nodes = List.generate(6, (_) => FocusNode());
  }

  String get _joined => _controllers.map((c) => c.text).join();

  void _changed(int index, String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 1) {
      for (var i = 0; i < digits.length && index + i < 6; i++) {
        _controllers[index + i].text = digits[i];
      }
      _nodes[(index + digits.length).clamp(0, 5).toInt()].requestFocus();
    } else {
      _controllers[index].text = digits;
      _controllers[index].selection = TextSelection.collapsed(offset: digits.length);
      if (digits.isNotEmpty && index < 5) _nodes[index + 1].requestFocus();
    }
    widget.onChanged(_joined);
    if (_joined.length == 6) widget.onCompleted?.call();
    setState(() {});
  }

  @override
  void dispose() {
    for (final c in _controllers) c.dispose();
    for (final n in _nodes) n.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Row(
    children: List.generate(6, (index) => Expanded(
      child: Padding(
        padding: EdgeInsets.only(right: index == 5 ? 0 : 8),
        child: TextField(
          controller: _controllers[index],
          focusNode: _nodes[index],
          enabled: widget.enabled,
          autofocus: index == 0,
          maxLength: 1,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          onChanged: (value) => _changed(index, value),
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          decoration: InputDecoration(
            counterText: '',
            filled: true,
            fillColor: _controllers[index].text.isNotEmpty ? AppColors.coral.withValues(alpha: .12) : Theme.of(context).colorScheme.surface,
            contentPadding: const EdgeInsets.symmetric(vertical: 15),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
    )),
  );
}
