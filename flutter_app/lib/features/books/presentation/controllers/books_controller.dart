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
  List<Book> library = const [];
  bool collectionLoading = false;
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

  Future<void> loadCollection() async {
    if (collectionLoading) return;
    collectionLoading = true;
    notifyListeners();
    try {
      library = await repository.getCollection();
    } catch (e) {
      error = client.errorMessage(e);
    } finally {
      collectionLoading = false;
      notifyListeners();
    }
  }

  Future<String?> addToCollection(Book book) async {
    try {
      await repository.addToCollection(book.id);
      if (!library.any((item) => item.id == book.id)) library = [...library, book];
      notifyListeners();
      return null;
    } catch (e) {
      return client.errorMessage(e);
    }
  }

  Future<String?> removeFromCollection(Book book) async {
    try {
      await repository.removeFromCollection(book.id);
      library = library.where((item) => item.id != book.id).toList();
      notifyListeners();
      return null;
    } catch (e) {
      return client.errorMessage(e);
    }
  }
}
