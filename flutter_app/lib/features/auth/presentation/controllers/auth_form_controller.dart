import 'package:flutter/foundation.dart';
import '../../../../core/network/api_client.dart';
import 'session_controller.dart';

enum AuthStep { details, otp, pin }

class AuthFormController extends ChangeNotifier {
  AuthFormController(this.session, this.client);

  bool _disposed = false;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  final SessionController session;
  final ApiClient client;
  bool isSignup = false;
  bool loading = false;
  AuthStep step = AuthStep.details;
  String name = '';
  String phone = '+91';
  String otp = '';
  String pin = '';
  String confirmPin = '';
  String challenge = '';
  String? testOtp;
  String? error;
  String? successMessage;

  void setName(String value) => name = value;
  void setPhone(String value) => phone = value.replaceAll(RegExp(r'[^\d+]'), '');
  void setOtp(String value) => otp = _sixDigits(value);
  void setPin(String value) => pin = _sixDigits(value);
  void setConfirmPin(String value) => confirmPin = _sixDigits(value);

  String _sixDigits(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    return digits.length > 6 ? digits.substring(0, 6) : digits;
  }

  void toggleMode() {
    isSignup = !isSignup;
    step = AuthStep.details;
    otp = '';
    pin = '';
    confirmPin = '';
    challenge = '';
    testOtp = null;
    error = null;
    successMessage = null;
    _notify();
  }

  void changeDetails() {
    step = AuthStep.details;
    otp = '';
    challenge = '';
    testOtp = null;
    error = null;
    _notify();
  }

  Future<void> submit() async {
    error = null;
    successMessage = null;
    if (!RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(phone)) {
      error = 'Enter a valid WhatsApp number with country code.';
      _notify();
      return;
    }
    loading = true;
    _notify();
    try {
      if (step == AuthStep.details) {
        if (isSignup) {
          if (name.trim().isEmpty) throw StateError('Enter your full name.');
          if (pin.length != 6) throw StateError('Create a 6-digit PIN.');
          if (pin != confirmPin) throw StateError('PIN numbers do not match.');
          final result = await session.requestSignupOtp(phone);
          testOtp = result['testOtp']?.toString();
        } else {
          final result = await session.requestLoginOtp(phone);
          testOtp = result['testOtp']?.toString();
        }
        step = AuthStep.otp;
      } else if (step == AuthStep.otp) {
        if (otp.length != 6) throw StateError('Enter the 6-digit OTP.');
        if (isSignup) {
          await session.signup(name.trim(), phone, pin, otp);
          successMessage = 'Your account was created successfully';
        } else {
          challenge = await session.verifyLoginOtp(phone, otp);
          step = AuthStep.pin;
          successMessage = 'OTP verified';
        }
      } else {
        if (pin.length != 6) throw StateError('Enter your 6-digit PIN.');
        await session.login(phone, pin, challenge);
        successMessage = 'Login successful';
      }
    } catch (exception) {
      error = client.errorMessage(exception);
    } finally {
      loading = false;
      _notify();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
