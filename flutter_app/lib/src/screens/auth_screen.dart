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

    final message = controller.successMessage;
    final error = controller.error;
    if (message == null && error == null) return;

    final successful = message != null;
    AppMessage.show(context, message ?? error!, success: successful);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final form = ref.watch(authFormControllerProvider);
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: MediaQuery.sizeOf(context).height - 96,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Image.asset(
                  'assets/images/happinotes-logo.png',
                  height: 150,
                  fit: BoxFit.contain,
                ),
                Text(
                  form.step == AuthStep.phone
                      ? 'Welcome to HappiNotes'
                      : form.step == AuthStep.otp
                      ? 'Verify WhatsApp'
                      : 'Enter your PIN',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 28),
                if (form.step == AuthStep.phone)
                  TextFormField(
                    initialValue: form.phone,
                    onChanged: form.setPhone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'WhatsApp number',
                    ),
                  ),
                if (form.step == AuthStep.otp) ...[
                  if (form.testOtp != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF163C27),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'DEMO OTP: ${form.testOtp}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFF8FE4AE),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  OtpBoxes(
                    value: form.otp,
                    enabled: !form.loading,
                    onChanged: (value) async {
                      form.setOtp(value);
                      if (value.length == 6 && !form.loading) {
                        await _submit(context, ref);
                      }
                    },
                  ),
                ],
                if (form.step == AuthStep.pin)
                  PinField(
                    value: form.pin,
                    onChanged: form.setPin,
                    label: '6-digit PIN',
                    obscure: true,
                  ),
                if (form.error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      form.error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                  ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: form.loading
                      ? null
                      : () => _submit(context, ref),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.coral,
                    padding: const EdgeInsets.all(17),
                  ),
                  child: Text(
                    form.loading
                        ? 'Please wait...'
                        : form.step == AuthStep.phone
                        ? 'Continue'
                        : form.step == AuthStep.otp
                        ? 'Verify OTP'
                        : 'Login',
                  ),
                ),
                if (form.step != AuthStep.phone)
                  TextButton(
                    onPressed: () =>
                        ref.read(authFormControllerProvider).reset(),
                    child: const Text('Change number'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class OtpBoxes extends StatelessWidget {
  const OtpBoxes({
    super.key,
    required this.value,
    required this.onChanged,
    required this.enabled,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (index) {
            final filled = index < value.length;
            final active = index == value.length;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: 44,
              height: 54,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: filled
                    ? AppColors.coral.withValues(alpha: 0.10)
                    : Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: filled || active
                      ? AppColors.coral
                      : Theme.of(context).colorScheme.outlineVariant,
                  width: active ? 2 : 1,
                ),
              ),
              child: Text(
                filled ? value[index] : '',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            );
          }),
        ),
        Positioned.fill(
          child: Opacity(
            opacity: 0.01,
            child: TextFormField(
              key: const ValueKey('otp-input'),
              initialValue: value,
              autofocus: true,
              enabled: enabled,
              onChanged: onChanged,
              keyboardType: TextInputType.number,
              autofillHints: const [AutofillHints.oneTimeCode],
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class PinField extends StatelessWidget {
  const PinField({
    super.key,
    required this.value,
    required this.onChanged,
    required this.label,
    this.obscure = false,
  });
  final String value, label;
  final ValueChanged<String> onChanged;
  final bool obscure;
  @override
  Widget build(BuildContext context) => TextFormField(
    key: ValueKey('$label-$value'),
    initialValue: value,
    onChanged: onChanged,
    obscureText: obscure,
    keyboardType: TextInputType.number,
    inputFormatters: [
      FilteringTextInputFormatter.digitsOnly,
      LengthLimitingTextInputFormatter(6),
    ],
    textAlign: TextAlign.center,
    style: TextStyle(
      fontSize: obscure ? 22 : 28,
      letterSpacing: obscure ? 10 : 18,
      fontWeight: FontWeight.w800,
    ),
    decoration: InputDecoration(labelText: label),
  );
}
