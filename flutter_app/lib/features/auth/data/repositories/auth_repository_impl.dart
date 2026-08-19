import '../../../../core/network/api_client.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../models/user_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this.client);
  final ApiClient client;
  @override
  Future<User?> restoreSession() async {
    if (await client.readToken() == null) return null;
    try {
      final r = await client.dio.get('/auth/me');
      return UserModel.fromJson(Map<String, dynamic>.from(r.data['user']));
    } catch (_) {
      await client.clearToken();
      return null;
    }
  }

  @override
  Future<Map<String, dynamic>> requestLoginOtp(String phoneNumber) async {
    final r = await client.dio.post(
      '/auth/request-login-otp',
      data: {'phoneNumber': phoneNumber},
    );
    return Map<String, dynamic>.from(r.data);
  }

  @override
  Future<String> verifyLoginOtp(String phoneNumber, String otp) async {
    final r = await client.dio.post(
      '/auth/verify-login-otp',
      data: {'phoneNumber': phoneNumber, 'otp': otp},
    );
    return r.data['loginChallenge'].toString();
  }

  @override
  Future<User> login({
    required String phoneNumber,
    required String pin,
    required String challenge,
  }) async {
    final r = await client.dio.post(
      '/auth/login',
      data: {
        'phoneNumber': phoneNumber,
        'pin': pin,
        'loginChallenge': challenge,
      },
    );
    await client.saveToken(r.data['token'].toString());
    return UserModel.fromJson(Map<String, dynamic>.from(r.data['user']));
  }

  @override
  Future<User> updateLanguage(String language) async {
    final r = await client.dio.put(
      '/auth/me',
      data: {'languagePreference': language},
    );
    final json = r.data['user'];
    if (json is Map) return UserModel.fromJson(Map<String, dynamic>.from(json));
    final me = await client.dio.get('/auth/me');
    return UserModel.fromJson(Map<String, dynamic>.from(me.data['user']));
  }

  @override
  Future<void> logout() => client.clearToken();
}
