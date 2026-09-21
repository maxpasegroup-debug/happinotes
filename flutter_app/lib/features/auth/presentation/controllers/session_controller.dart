import 'package:flutter/foundation.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';

class SessionController extends ChangeNotifier {
  SessionController(this.repository);
  final AuthRepository repository;
  User? user;
  bool initialized = false;
  bool _disposed = false;
  bool get isLoggedIn => user != null;
  Future<void> initialize() async {
    await Future.wait([
      _restore(),
      Future<void>.delayed(const Duration(milliseconds: 1700)),
    ]);
    if (!_disposed) {
      initialized = true;
      notifyListeners();
    }
  }

  Future<void> _restore() async {
    try {
      final restoredUser = await repository.restoreSession();
      if (!_disposed) {
        user = restoredUser;
        // Notify while the splash is still visible so dependent data can
        // begin loading before the first home frame is shown.
        notifyListeners();
      }
    } catch (_) {
      // Storage failures must not leave startup stuck on the splash screen.
      if (!_disposed) {
        user = null;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  Future<Map<String, dynamic>> requestSignupOtp(String phone) =>
      repository.requestSignupOtp(phone);
  Future<Map<String, dynamic>> requestLoginOtp(String phone) =>
      repository.requestLoginOtp(phone);
  Future<String> verifyLoginOtp(String phone, String otp) =>
      repository.verifyLoginOtp(phone, otp);

  Future<void> signup(String name, String phone, String pin, String otp) async {
    user = await repository.signup(
      name: name,
      phoneNumber: phone,
      pin: pin,
      otp: otp,
    );
    notifyListeners();
  }

  Future<void> login(String phone, String pin, String challenge) async {
    user = await repository.login(
      phoneNumber: phone,
      pin: pin,
      challenge: challenge,
    );
    notifyListeners();
  }

  Future<void> updateLanguage(String value) async {
    user = await repository.updateLanguage(value);
    notifyListeners();
  }

  void replaceUser(User value) {
    user = value;
    notifyListeners();
  }

  Future<void> logout() async {
    await repository.logout();
    user = null;
    notifyListeners();
  }
}
