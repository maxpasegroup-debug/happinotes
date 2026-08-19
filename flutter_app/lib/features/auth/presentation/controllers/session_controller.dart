import 'package:flutter/foundation.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';

class SessionController extends ChangeNotifier {
  SessionController(this.repository);
  final AuthRepository repository;
  User? user;
  bool initialized = false;
  bool get isLoggedIn => user != null;
  Future<void> initialize() async {
    await Future.wait([
      _restore(),
      Future<void>.delayed(const Duration(milliseconds: 1700)),
    ]);
    initialized = true;
    notifyListeners();
  }

  Future<void> _restore() async {
    user = await repository.restoreSession();
  }

  Future<Map<String, dynamic>> requestLoginOtp(String phone) =>
      repository.requestLoginOtp(phone);
  Future<String> verifyLoginOtp(String phone, String otp) =>
      repository.verifyLoginOtp(phone, otp);
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
