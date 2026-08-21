import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/repositories/admin_repository.dart';

class AdminRepositoryImpl implements AdminRepository {
  AdminRepositoryImpl(this.client);
  final ApiClient client;

  Map<String, dynamic> _map(dynamic value) =>
      Map<String, dynamic>.from(value as Map);

  @override
  Future<Map<String, dynamic>> getStats() async => <String, dynamic>{};

  @override
  Future<List<Map<String, dynamic>>> getBooks() async =>
      ((await client.dio.get('/admin/contents')).data['contents'] as List)
          .map(_map)
          .where((item) => item['contentType'] == 'lifebook')
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
  Future<Map<String, dynamic>> upload(String path, String scope) async {
    final fileName = path.split(RegExp(r'[/\\]')).last;
    final extension = fileName.split('.').last.toLowerCase();
    final mimeType = scope != 'thumbnail'
        ? 'audio/mpeg'
        : extension == 'png'
        ? 'image/png'
        : extension == 'webp'
        ? 'image/webp'
        : 'image/jpeg';
    final form = FormData.fromMap({
      'media': await MultipartFile.fromFile(
        path,
        filename: fileName,
        contentType: DioMediaType.parse(mimeType),
      ),
      'scope': scope,
    });
    final response = await client.dio.post(
      '/admin/contents/upload-media',
      data: form,
    );
    return _map(response.data);
  }

  @override
  Future<Map<String, dynamic>> createBook(Map<String, dynamic> data) async =>
      _map((await client.dio.post('/admin/contents', data: data)).data['content']);

  @override
  Future<void> updateBook(String id, Map<String, dynamic> data) async =>
      client.dio.put('/admin/contents/$id', data: data);

  @override
  Future<void> updateBookStatus(String id, String status) async =>
      client.dio.patch('/admin/contents/$id/status', data: {'status': status});

  @override
  Future<void> deleteBook(String id) async =>
      client.dio.delete('/admin/contents/$id');

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
