import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  ApiClient({FlutterSecureStorage? secureStorage})
    : _storage = secureStorage ?? const FlutterSecureStorage() {
    dio =
        Dio(
            BaseOptions(
              baseUrl: baseUrl,
              connectTimeout: const Duration(seconds: 20),
              receiveTimeout: const Duration(seconds: 30),
            ),
          )
          ..interceptors.add(
            InterceptorsWrapper(
              onRequest: (options, handler) async {
                final token = await readToken();
                if (token != null) {
                  options.headers['Authorization'] = 'Bearer $token';
                }
                handler.next(options);
              },
            ),
          );
  }
  static const baseUrl =
      'https://happinotes-production-6b44.up.railway.app/api';
  static const _tokenKey = 'jwt_token';
  final FlutterSecureStorage _storage;
  late final Dio dio;
  Future<void> saveToken(String value) =>
      _storage.write(key: _tokenKey, value: value);
  Future<String?> readToken() => _storage.read(key: _tokenKey);
  Future<void> clearToken() => _storage.delete(key: _tokenKey);
  String errorMessage(Object error) {
    if (error is DioException && error.response?.data is Map) {
      final data = error.response!.data as Map;
      return (data['message'] ?? data['error'] ?? 'Network request failed')
          .toString();
    }
    return error is StateError ? error.message : 'Network request failed';
  }
}
