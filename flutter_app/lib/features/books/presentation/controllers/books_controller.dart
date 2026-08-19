import 'package:flutter/foundation.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/book.dart';
import '../../domain/repositories/books_repository.dart';

class BooksController extends ChangeNotifier {
  BooksController(this.repository, this.client);
  final BooksRepository repository;
  final ApiClient client;
  List<Book> books = const [];
  List<Book> upcoming = const [];
  bool loading = false;
  String? error;
  Future<void> loadBooks({String? query, String? language}) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final result = await Future.wait([
        repository.getBooks(query: query, language: language),
        repository.getUpcomingBooks(language: language),
      ]);
      books = result[0];
      upcoming = result[1];
    } catch (e) {
      error = client.errorMessage(e);
    }
    loading = false;
    notifyListeners();
  }
}
