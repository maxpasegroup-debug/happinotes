import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/repositories/admin_repository.dart';

class AdminRepositoryImpl implements AdminRepository {
  AdminRepositoryImpl(this.client);
  final ApiClient client;

  Map<String, dynamic> _map(dynamic value) =>
      Map<String, dynamic>.from(value as Map);

  @override
  Future<Map<String, dynamic>> getStats() async =>
      _map((await client.dio.get('/admin/stats')).data['stats']);

  @override
  Future<List<Map<String, dynamic>>> getBooks() async =>
      ((await client.dio.get('/admin/books')).data['books'] as List)
          .map(_map)
          .toList();

  @override
  Future<List<Map<String, dynamic>>> getUsers() async =>
      ((await client.dio.get('/admin/users')).data['users'] as List)
          .map(_map)
          .toList();

  @override
  Future<void> updateUserSubscription(String id, String status) async => client
      .dio
      .put('/admin/users/$id/subscription', data: {'subscriptionStatus': status});

  @override
  Future<void> deleteUser(String id) async => client.dio.delete('/admin/users/$id');

  @override
  Future<Map<String, dynamic>> upload(String path, String kind) async {
    final fileName = path.split(RegExp(r'[/\\]')).last;
    final extension = fileName.split('.').last.toLowerCase();
    final mimeType = kind == 'audio'
        ? 'audio/mpeg'
        : extension == 'png'
        ? 'image/png'
        : extension == 'webp'
        ? 'image/webp'
        : 'image/jpeg';
    final form = FormData.fromMap({
      'scope': kind == 'cover' ? 'cover' : 'lesson',
      'media': await MultipartFile.fromFile(
        path,
        filename: fileName,
        contentType: DioMediaType.parse(mimeType),
      ),
    });
    final response = await client.dio.post(
      '/admin/contents/upload-media',
      data: form,
    );
    return {
      'url': response.data['url'],
      'mediaType': response.data['mediaType'],
    };
  }

  @override
  Future<void> createBook(Map<String, dynamic> data) async =>
      client.dio.post('/admin/books', data: data);

  @override
  Future<void> updateBook(String id, Map<String, dynamic> data) async =>
      client.dio.put('/admin/books/$id', data: data);

  @override
  Future<void> deleteBook(String id) async =>
      client.dio.delete('/admin/books/$id');

  @override
  Future<void> sendNotification(
    String title,
    String message,
    String target,
  ) async => client.dio.post(
    '/admin/notify',
    data: {'title': title, 'message': message, 'target': target},
  );
}
