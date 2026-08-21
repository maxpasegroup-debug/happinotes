import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/book.dart';
import '../../domain/repositories/books_repository.dart';
import '../../data/models/book_model.dart';

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
  Future<void> loadBooks({String? query, String? language, bool forceRefresh = false}) async {
    final canUseCache = query?.isEmpty != false &&
        (language == null || language == 'all');
    if (!forceRefresh && canUseCache && await _restoreCacheIfFresh()) return;
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
      if (canUseCache) await _saveCache();
    } catch (e) {
      error = client.errorMessage(e);
    }
    loading = false;
    notifyListeners();
  }

  Future<bool> _restoreCacheIfFresh() async {
    final preferences = await SharedPreferences.getInstance();
    final savedAt = preferences.getInt('books_cache_saved_at');
    final rawBooks = preferences.getString('books_cache');
    if (savedAt == null || rawBooks == null) return false;
    final age = DateTime.now().millisecondsSinceEpoch - savedAt;
    if (age > const Duration(minutes: 10).inMilliseconds) return false;
    try {
      final data = jsonDecode(rawBooks) as Map<String, dynamic>;
      books = _decodeBooks(data['books']);
      upcoming = _decodeBooks(data['upcoming']);
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _saveCache() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(
      'books_cache',
      jsonEncode({
        'books': books.map(_encodeBook).toList(),
        'upcoming': upcoming.map(_encodeBook).toList(),
      }),
    );
    await preferences.setInt(
      'books_cache_saved_at',
      DateTime.now().millisecondsSinceEpoch,
    );
  }

  Map<String, dynamic> _encodeBook(Book book) => {
    '_id': book.id,
    'title': book.title,
    'description': book.description,
    'language': book.language,
    'category': book.category,
    'thumbnailUrl': book.coverImageUrl,
    'introAudioUrl': book.audioUrl,
    'type': book.accessType,
    'status': book.status,
    'totalDurationSeconds': book.duration,
  };

  List<Book> _decodeBooks(dynamic value) => (value as List? ?? [])
      .map((item) => BookModel.fromJson(Map<String, dynamic>.from(item)))
      .toList();

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
