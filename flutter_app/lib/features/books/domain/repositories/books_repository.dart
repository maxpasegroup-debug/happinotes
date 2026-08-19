import '../entities/book.dart';

abstract interface class BooksRepository {
  Future<List<Book>> getBooks({String? query, String? language});
  Future<List<Book>> getUpcomingBooks({String? language});
}
