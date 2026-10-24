import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_config.dart';

class ApiClient {
  ApiClient({
    FlutterSecureStorage? secureStorage,
    String? apiBaseUrl,
    bool? releaseBuild,
  }) : _storage = secureStorage ?? const FlutterSecureStorage(),
       _baseUrl = resolveApiBaseUrl(
         apiBaseUrl ?? configuredApiBaseUrl.value,
         isRelease: releaseBuild ?? kReleaseMode,
       ) {
    dio =
        Dio(
            BaseOptions(
              baseUrl: _baseUrl,
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
  static String get baseUrl => resolveApiBaseUrl(
    configuredApiBaseUrl.value,
    isRelease: kReleaseMode,
  );
  static const _tokenKey = 'jwt_token';
  final FlutterSecureStorage _storage;
  final String _baseUrl;
  late final Dio dio;
  Future<void> saveToken(String value) =>
      _storage.write(key: _tokenKey, value: value);
  Future<String?> readToken() => _storage.read(key: _tokenKey);
  Future<void> clearToken() => _storage.delete(key: _tokenKey);
  String errorMessage(Object error) {
    if (error is DioException) {
      final response = error.response;
      if (response?.data is Map) {
        final data = response!.data as Map;
        return (data['message'] ??
                data['error'] ??
                'Request failed (${response.statusCode})')
            .toString();
      }
      if (response != null) {
        return 'Request failed: HTTP ${response.statusCode}';
      }
      if (error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout) {
        return 'Cannot reach the backend. Check the Railway service and internet connection.';
      }
      return 'Request failed: ${error.message ?? error.type.name}';
    }
    return error is StateError ? error.message : 'Network request failed';
  }
}
