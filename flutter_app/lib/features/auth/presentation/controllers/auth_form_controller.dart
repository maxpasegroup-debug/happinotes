import 'package:flutter/foundation.dart';
import '../../../../core/network/api_client.dart';
import 'session_controller.dart';

enum AuthStep { email, otp, password }

class AuthFormController extends ChangeNotifier {
  AuthFormController(this.session, this.client);
  final SessionController session;
  final ApiClient client;
  bool isSignup = false;
  bool loading = false;
  AuthStep step = AuthStep.email;
  String name = '', email = '', otp = '', password = '', confirmPassword = '';
  String challenge = '';
  String? testOtp, error, successMessage;
  bool _disposed = false;
  void _notify() { if (!_disposed) notifyListeners(); }
  void setName(String v) { name = v; _notify(); }
  void setEmail(String v) { email = v.trim(); _notify(); }
  void setOtp(String v) { otp = v.replaceAll(RegExp(r'\D'), '').split('').take(6).join(); _notify(); }
  void setPassword(String v) { password = v; _notify(); }
  void setConfirmPassword(String v) { confirmPassword = v; _notify(); }

  void toggleMode() {
    isSignup = !isSignup; step = AuthStep.email; name = ''; password = ''; confirmPassword = ''; otp = ''; challenge = ''; testOtp = null; error = null; successMessage = null; _notify();
  }
  void changeEmail() { step = AuthStep.email; otp = ''; challenge = ''; testOtp = null; error = null; _notify(); }

  Future<void> submit() async {
    error = null; successMessage = null;
    if (step == AuthStep.email) {
      if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) { error = 'Enter a valid email address.'; _notify(); return; }
    } else if (step == AuthStep.otp) {
      if (otp.length != 6) { error = 'Enter the 6-digit OTP.'; _notify(); return; }
    } else {
      if (isSignup && name.trim().isEmpty) { error = 'Enter your full name.'; _notify(); return; }
      if (password.length < 6) { error = 'Password must be at least 6 characters.'; _notify(); return; }
      if (isSignup && password != confirmPassword) { error = 'Passwords do not match.'; _notify(); return; }
    }
    loading = true; _notify();
    try {
      if (step == AuthStep.email) {
        final result = await session.requestEmailOtp(email, isSignup);
        testOtp = result['testOtp']?.toString();
        step = AuthStep.otp;
      } else if (step == AuthStep.otp) {
        challenge = await session.verifyEmailOtp(email, otp, isSignup);
        step = AuthStep.password;
      } else if (isSignup) {
        await session.signupWithEmailChallenge(name.trim(), email, password, challenge);
        successMessage = 'Your account was created successfully';
      } else {
        await session.loginWithEmailChallenge(email, password, challenge);
        successMessage = 'Login successful';
      }
    } catch (exception) { error = client.errorMessage(exception); }
    finally { loading = false; _notify(); }
  }

  @override
  void dispose() { _disposed = true; super.dispose(); }
}
