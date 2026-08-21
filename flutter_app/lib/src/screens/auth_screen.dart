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
    if (controller.successMessage != null || controller.error != null) {
      AppMessage.showGlobal(
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
                  OtpBoxes(
                    value: form.otp,
                    onChanged: form.setOtp,
                    enabled: !form.loading,
                    onCompleted: () => _submit(context, ref),
                  ),
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

class OtpBoxes extends StatefulWidget {
  const OtpBoxes({
    super.key,
    required this.value,
    required this.onChanged,
    required this.enabled,
    this.onCompleted,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final bool enabled;
  final VoidCallback? onCompleted;

  @override
  State<OtpBoxes> createState() => _OtpBoxesState();
}

class _OtpBoxesState extends State<OtpBoxes> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(6, (index) => TextEditingController(
      text: index < widget.value.length ? widget.value[index] : '',
    ));
    _focusNodes = List.generate(6, (_) => FocusNode());
  }

  @override
  void didUpdateWidget(covariant OtpBoxes oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value && widget.value != _value) {
      for (var i = 0; i < 6; i++) {
        _controllers[i].text = i < widget.value.length ? widget.value[i] : '';
      }
    }
  }

  String get _value => _controllers.map((controller) => controller.text).join();

  void _changed(int index, String value) {
    final digit = value.replaceAll(RegExp(r'\D'), '');
    if (digit.length > 1) {
      final pasted = digit.substring(0, digit.length > 6 ? 6 : digit.length);
      for (var i = 0; i < pasted.length && index + i < 6; i++) {
        _controllers[index + i].text = pasted[i];
      }
      final next = (index + pasted.length).clamp(0, 5);
      _focusNodes[next].requestFocus();
    } else {
      _controllers[index].text = digit;
      _controllers[index].selection = TextSelection.collapsed(offset: digit.length);
      if (digit.isNotEmpty && index < 5) _focusNodes[index + 1].requestFocus();
    }
    widget.onChanged(_value);
    if (_value.length == 6) widget.onCompleted?.call();
    setState(() {});
  }

  KeyEventResult _keyEvent(int index, KeyEvent event) {
    if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.backspace && _controllers[index].text.isEmpty && index > 0) {
      _controllers[index - 1].clear();
      _focusNodes[index - 1].requestFocus();
      widget.onChanged(_value);
      setState(() {});
    }
    return KeyEventResult.ignored;
  }

  @override
  void dispose() {
    for (final controller in _controllers) controller.dispose();
    for (final node in _focusNodes) node.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final gap = constraints.maxWidth < 360 ? 6.0 : 9.0;
      return Row(
        children: List.generate(6, (index) => Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: index == 5 ? 0 : gap),
            child: Focus(
              onKeyEvent: (_, event) => _keyEvent(index, event),
              child: TextField(
                controller: _controllers[index],
                focusNode: _focusNodes[index],
                enabled: widget.enabled,
                autofocus: index == 0,
                maxLength: 1,
                textAlign: TextAlign.center,
                keyboardType: TextInputType.number,
                onChanged: (value) => _changed(index, value),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                decoration: InputDecoration(
                  counterText: '',
                  filled: true,
                  fillColor: _controllers[index].text.isNotEmpty
                      ? AppColors.coral.withValues(alpha: .12)
                      : Theme.of(context).colorScheme.surface,
                  contentPadding: const EdgeInsets.symmetric(vertical: 15),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.coral, width: 2),
                  ),
                ),
              ),
            ),
          ),
        )),
      );
    },
  );
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
