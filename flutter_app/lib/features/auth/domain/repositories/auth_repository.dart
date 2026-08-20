import '../entities/user.dart';

abstract interface class AuthRepository {
  Future<User?> restoreSession();
  Future<Map<String, dynamic>> requestSignupOtp(String phoneNumber);
  Future<Map<String, dynamic>> requestLoginOtp(String phoneNumber);
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
  Future<User> updateLanguage(String language);
  Future<void> logout();
}
