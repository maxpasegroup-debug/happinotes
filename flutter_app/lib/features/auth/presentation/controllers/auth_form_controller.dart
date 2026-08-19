import 'package:flutter/foundation.dart';
import '../../../../core/network/api_client.dart';
import 'session_controller.dart';

enum AuthStep { phone, otp, pin }

class AuthFormController extends ChangeNotifier {
  AuthFormController(this.session, this.client);
  final SessionController session;
  final ApiClient client;
  AuthStep step = AuthStep.phone;
  String phone = '+91', otp = '', pin = '', challenge = '';
  String? testOtp, error, successMessage;
  bool loading = false;

  void setPhone(String value) => phone = value;
  void setOtp(String value) {
    final next = _sixDigits(value);
    if (next == otp) return;
    otp = next;
    notifyListeners();
  }
  void setPin(String value) => pin = _sixDigits(value);
  String _sixDigits(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    return digits.length > 6 ? digits.substring(0, 6) : digits;
  }

  void reset() {
    step = AuthStep.phone;
    otp = '';
    pin = '';
    challenge = '';
    error = null;
    successMessage = null;
    notifyListeners();
  }

  Future<void> submit() async {
    loading = true;
    error = null;
    successMessage = null;
    notifyListeners();
    try {
      if (step == AuthStep.phone) {
        final result = await session.requestLoginOtp(phone.trim());
        testOtp = result['testOtp']?.toString();
        step = AuthStep.otp;
      } else if (step == AuthStep.otp) {
        if (otp.length != 6) throw StateError('Enter the 6-digit OTP.');
        challenge = await session.verifyLoginOtp(phone.trim(), otp);
        step = AuthStep.pin;
        successMessage = 'OTP verified';
      } else {
        if (pin.length != 6) throw StateError('Enter your 6-digit PIN.');
        await session.login(phone.trim(), pin, challenge);
        successMessage = 'Login successful';
      }
    } catch (exception) {
      error = client.errorMessage(exception);
    }
    loading = false;
    notifyListeners();
  }
}
