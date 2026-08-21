import '../../../../core/network/api_client.dart';
import '../../domain/entities/book.dart';
import '../../domain/repositories/books_repository.dart';
import '../models/book_model.dart';

class BooksRepositoryImpl implements BooksRepository {
  BooksRepositoryImpl(this.client);
  final ApiClient client;
  @override
  Future<List<Book>> getBooks({String? query, String? language}) async {
    final r = await client.dio.get(
      '/contents',
      queryParameters: {
        'type': 'lifebook',
        'view': 'mobile',
      },
    );
    return (r.data['contents'] as List? ?? [])
        .map((x) => BookModel.fromJson(Map<String, dynamic>.from(x)))
        .where((book) => book.status == 'live')
        .where((book) => language == null || language == 'all' || book.language == language)
        .where((book) => query?.isNotEmpty != true || book.title.toLowerCase().contains(query!.toLowerCase()))
        .toList();
  }

  @override
  Future<List<Book>> getUpcomingBooks({String? language}) async {
    final response = await client.dio.get(
      '/contents',
      queryParameters: {
        'type': 'lifebook',
        'view': 'mobile',
      },
    );
    return (response.data['contents'] as List? ?? [])
        .map((value) => BookModel.fromJson(Map<String, dynamic>.from(value)))
        .where((book) => book.status == 'coming_soon')
        .where((book) => language == null || language == 'all' || book.language == language)
        .toList();
  }
}
