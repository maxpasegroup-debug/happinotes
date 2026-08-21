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
      '/books',
      queryParameters: {
        if (query?.isNotEmpty == true) 'query': query,
        if (language != null && language != 'all') 'language': language,
      },
    );
    return (r.data['books'] as List? ?? [])
        .map((x) => BookModel.fromJson(Map<String, dynamic>.from(x)))
        .toList();
  }

  @override
  Future<List<Book>> getUpcomingBooks({String? language}) async {
    final response = await client.dio.get(
      '/books/upcoming',
      queryParameters: {
        if (language != null && language != 'all') 'language': language,
      },
    );
    return (response.data['books'] as List? ?? [])
        .map((value) => BookModel.fromJson(Map<String, dynamic>.from(value)))
        .toList();
  }

  @override
  Future<List<Book>> getCollection() async {
    final response = await client.dio.get('/collection');
    return (response.data['collection'] as List? ?? [])
        .map((value) => BookModel.fromJson(Map<String, dynamic>.from(value)))
        .toList();
  }

  @override
  Future<void> addToCollection(String bookId) async {
    await client.dio.post('/collection/$bookId');
  }

  @override
  Future<void> removeFromCollection(String bookId) async {
    await client.dio.delete('/collection/$bookId');
  }
}
