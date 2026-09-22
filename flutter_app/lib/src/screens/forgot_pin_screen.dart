import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../theme.dart';
import '../widgets/app_message.dart';

class ForgotPinScreen extends ConsumerStatefulWidget {
  const ForgotPinScreen({super.key});

  @override
  ConsumerState<ForgotPinScreen> createState() => _ForgotPinScreenState();
}

class _ForgotPinScreenState extends ConsumerState<ForgotPinScreen> {
  final phone = TextEditingController();
  final otp = TextEditingController();
  final pin = TextEditingController();
  bool sent = false, loading = false, obscureNewPin = true;
  String? testOtp, error, success;

  String get normalizedPhone {
    final digits = phone.text.replaceAll(RegExp(r'\D'), '');
    final local = digits.startsWith('91') && digits.length > 10 ? digits.substring(2) : digits;
    return local.isEmpty ? '' : '+91$local';
  }

  @override
  void dispose() {
    phone.dispose();
    otp.dispose();
    pin.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { loading = true; error = null; success = null; });
    try {
      final repository = ref.read(authRepositoryProvider);
      if (!sent) {
        final result = await repository.requestResetPinOtp(normalizedPhone);
        testOtp = result['testOtp']?.toString();
        sent = true;
      } else {
        if (!RegExp(r'^\d{6}$').hasMatch(otp.text) || !RegExp(r'^\d{6}$').hasMatch(pin.text)) {
          throw StateError('Enter a 6-digit OTP and new PIN.');
        }
        await repository.resetPin(phoneNumber: normalizedPhone, otp: otp.text, pin: pin.text);
        if (mounted) {
          AppMessage.showGlobal('PIN reset successfully. You can log in now.', success: true);
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
    appBar: AppBar(title: const Text('Forgot PIN')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text('Reset your 6-digit PIN', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        const Text('Enter your WhatsApp number to receive a reset OTP.'),
        const SizedBox(height: 24),
        TextField(controller: phone, enabled: !sent, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'WhatsApp number', prefixText: '+91 ', prefixStyle: TextStyle(color: Colors.black, fontWeight: FontWeight.w600), hintText: '9876543210')),
        if (sent) ...[
          const SizedBox(height: 14),
          if (testOtp != null) Text('DEMO OTP: $testOtp', style: const TextStyle(color: AppColors.coral, fontWeight: FontWeight.w800)),
          TextField(controller: otp, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)], decoration: const InputDecoration(labelText: 'OTP')),
          const SizedBox(height: 14),
          TextField(
            controller: pin,
            obscureText: obscureNewPin,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
            decoration: InputDecoration(
              labelText: 'New 6-digit PIN',
              suffixIcon: IconButton(
                tooltip: obscureNewPin ? 'Show PIN' : 'Hide PIN',
                icon: Icon(obscureNewPin ? Icons.visibility_rounded : Icons.visibility_off_rounded),
                onPressed: () => setState(() => obscureNewPin = !obscureNewPin),
              ),
            ),
          ),
        ],
        if (error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(error!, style: const TextStyle(color: Colors.redAccent))),
        if (success != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(success!, style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w700))),
        const SizedBox(height: 24),
        FilledButton(onPressed: loading || success != null ? null : _submit, style: FilledButton.styleFrom(backgroundColor: AppColors.coral, padding: const EdgeInsets.all(17)), child: Text(loading ? 'Please wait...' : sent ? 'Reset PIN' : 'Send OTP')),
      ],
    ),
  );
}
