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
}
