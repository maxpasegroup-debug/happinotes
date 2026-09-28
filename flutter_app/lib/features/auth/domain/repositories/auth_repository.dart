import '../entities/user.dart';

abstract interface class AuthRepository {
  Future<User?> restoreSession();
  Future<Map<String, dynamic>> requestSignupOtp(String phoneNumber);
  Future<Map<String, dynamic>> requestLoginOtp(String phoneNumber);
  Future<Map<String, dynamic>> requestResetPinOtp(String phoneNumber);
  Future<void> resetPin({required String phoneNumber, required String otp, required String pin});
  Future<Map<String, dynamic>> requestPasswordReset(String email);
  Future<void> verifyPasswordOtp({required String email, required String otp});
  Future<void> resetPassword({required String email, required String otp, required String newPassword});
  Future<String> verifyLoginOtp(String phoneNumber, String otp);
  Future<User> signup({
    required String name,
    required String phoneNumber,
    required String pin,
    required String otp,
  });
  Future<User> login({
    required String phoneNumber,
    required String pin,
    required String challenge,
  });
  Future<User> signupWithEmail({required String name, required String email, required String password});
  Future<User> loginWithEmail({required String email, required String password});
  Future<Map<String, dynamic>> requestEmailOtp({required String email, required bool signup});
  Future<String> verifyEmailOtp({required String email, required String otp, required bool signup});
  Future<User> signupWithEmailChallenge({required String name, required String email, required String password, required String challenge});
  Future<User> loginWithEmailChallenge({required String email, required String password, required String challenge});
  Future<User> updateLanguage(String language);
  Future<void> logout();
}
