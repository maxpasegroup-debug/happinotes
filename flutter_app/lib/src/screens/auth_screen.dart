import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/auth/presentation/controllers/auth_form_controller.dart';
import '../theme.dart';
import '../widgets/app_message.dart';

class AuthScreen extends ConsumerWidget {
  const AuthScreen({super.key});

  Future<void> _submit(BuildContext context, WidgetRef ref) async {
    final controller = ref.read(authFormControllerProvider);
    await controller.submit();
    if (!context.mounted) return;
    if (controller.successMessage != null || controller.error != null) {
      AppMessage.show(
        context,
        controller.successMessage ?? controller.error!,
        success: controller.successMessage != null,
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final form = ref.watch(authFormControllerProvider);
    final heading = form.step == AuthStep.otp
        ? 'Verify WhatsApp'
        : form.step == AuthStep.pin
        ? 'Enter your PIN'
        : form.isSignup
        ? 'Create your account'
        : 'Welcome back';
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height - 96),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Image.asset('assets/images/happinotes-logo.png', height: 140),
                Text(heading, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 28),
                if (form.step == AuthStep.details) ...[
                  if (form.isSignup) ...[
                    TextFormField(
                      initialValue: form.name,
                      onChanged: form.setName,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Full name'),
                    ),
                    const SizedBox(height: 14),
                  ],
                  TextFormField(
                    initialValue: form.phone,
                    onChanged: form.setPhone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'WhatsApp number',
                      hintText: '+919876543210',
                    ),
                  ),
                  if (form.isSignup) ...[
                    const SizedBox(height: 14),
                    _PinField(value: form.pin, onChanged: form.setPin, label: 'Create 6-digit PIN'),
                    const SizedBox(height: 14),
                    _PinField(value: form.confirmPin, onChanged: form.setConfirmPin, label: 'Confirm 6-digit PIN'),
                  ],
                ],
                if (form.step == AuthStep.otp) ...[
                  Text('Enter the code sent to ${form.phone}', textAlign: TextAlign.center),
                  const SizedBox(height: 14),
                  if (form.testOtp != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 14),
                      decoration: BoxDecoration(color: const Color(0xFF163C27), borderRadius: BorderRadius.circular(12)),
                      child: Text('DEMO OTP: ${form.testOtp}', textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF8FE4AE), fontWeight: FontWeight.w800)),
                    ),
                  _PinField(value: form.otp, onChanged: form.setOtp, label: '6-digit OTP', obscure: false),
                ],
                if (form.step == AuthStep.pin)
                  _PinField(value: form.pin, onChanged: form.setPin, label: '6-digit PIN'),
                if (form.error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(form.error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.redAccent)),
                  ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: form.loading ? null : () => _submit(context, ref),
                  style: FilledButton.styleFrom(backgroundColor: AppColors.coral, padding: const EdgeInsets.all(17)),
                  child: Text(form.loading
                      ? 'Please wait...'
                      : form.step == AuthStep.details
                      ? 'Get WhatsApp OTP'
                      : form.step == AuthStep.otp
                      ? (form.isSignup ? 'Verify & Create Account' : 'Verify OTP')
                      : 'Login'),
                ),
                if (form.step != AuthStep.details)
                  TextButton(onPressed: form.loading ? null : form.changeDetails, child: const Text('Change details')),
                if (form.step == AuthStep.details)
                  TextButton(
                    onPressed: form.loading ? null : form.toggleMode,
                    child: Text(form.isSignup ? 'Already have an account? Login' : 'New to HappiNotes? Create account'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PinField extends StatelessWidget {
  const _PinField({required this.value, required this.onChanged, required this.label, this.obscure = true});
  final String value;
  final ValueChanged<String> onChanged;
  final String label;
  final bool obscure;

  @override
  Widget build(BuildContext context) => TextFormField(
    key: ValueKey('$label-$value'),
    initialValue: value,
    onChanged: onChanged,
    obscureText: obscure,
    keyboardType: TextInputType.number,
    inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
    decoration: InputDecoration(labelText: label),
  );
}
