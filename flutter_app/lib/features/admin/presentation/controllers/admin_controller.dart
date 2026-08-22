import 'package:flutter/foundation.dart';
import 'package:file_picker/file_picker.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/repositories/admin_repository.dart';

class BookDraft {
  String? id;
  String title = '', description = '', language = 'english';
  String category = 'happiness', status = 'draft', accessType = 'free';
  String coverImageUrl = '', coverPublicId = '';
  String introAudioUrl = '', introAudioPublicId = '', audioFileName = '';
  String duration = '0', sortOrder = '0', tags = '';
  bool featured = false, trending = false;
  List<Map<String, dynamic>> episodes = [];

  BookDraft();
  BookDraft.fromJson(Map<String, dynamic> j) {
    id = j['_id']?.toString();
    title = (j['title'] ?? '').toString();
    description = (j['description'] ?? '').toString();
    language = (j['language'] ?? 'english').toString();
    category = (j['category'] ?? 'happiness').toString();
    status = (j['status'] ?? 'draft').toString();
    accessType = (j['accessType'] ?? 'free').toString();
    coverImageUrl = (j['coverImageUrl'] ?? j['thumbnailUrl'] ?? '').toString();
    coverPublicId = (j['coverPublicId'] ?? '').toString();
    introAudioUrl = (j['introAudioUrl'] ?? '').toString();
    introAudioPublicId = (j['introAudioPublicId'] ?? '').toString();
    audioFileName = (j['introAudioFileName'] ?? '').toString();
    duration = (j['totalDurationSeconds'] ?? 0).toString();
    sortOrder = (j['sortOrder'] ?? 0).toString();
    tags = ((j['tags'] as List?) ?? []).join(', ');
    featured = j['isFeatured'] == true;
    trending = j['isTrending'] == true;
    episodes = ((j['lessons'] as List?) ?? [])
        .whereType<Map>()
        .map((lesson) => Map<String, dynamic>.from(lesson))
        .toList();
    if (episodes.isEmpty && introAudioUrl.isNotEmpty) {
      episodes.add({
        'title': 'Episode 1',
        'description': '',
        'mediaUrl': introAudioUrl,
        'mediaType': 'audio',
        'order': 0,
        'fileName': audioFileName,
      });
    }
  }

  Map<String, dynamic> toJson() => {
    'title': title.trim(),
    'description': description.trim(),
    'language': language,
    'category': category,
    'status': status,
    'accessType': accessType,
    'type': accessType,
    'coverImageUrl': coverImageUrl,
    'thumbnailUrl': coverImageUrl,
    'coverPublicId': coverPublicId,
    'introAudioUrl': introAudioUrl,
    'introAudioPublicId': introAudioPublicId,
    'introAudioFileName': audioFileName,
    'totalDurationSeconds': int.tryParse(duration) ?? 0,
    'sortOrder': int.tryParse(sortOrder) ?? 0,
    'tags': tags.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList(),
    'isFeatured': featured,
    'isTrending': trending,
    'lessons': episodes,
  };
}

class AdminController extends ChangeNotifier {
  AdminController(this.repository, this.client) { loadAll(); }
  final AdminRepository repository;
  final ApiClient client;
  Map<String, dynamic> stats = {};
  List<Map<String, dynamic>> books = [], users = [];
  int tab = 0;
  bool loading = true, busy = false;
  String? error, success;
  BookDraft draft = BookDraft();

  void selectTab(int value) { tab = value; notifyListeners(); }
  void notifyChanged() => notifyListeners();
  void newBook() { draft = BookDraft(); error = null; notifyListeners(); }
  void editBook(Map<String, dynamic> book) { draft = BookDraft.fromJson(book); error = null; notifyListeners(); }

  Future<void> loadAll() async {
    loading = true; error = null; notifyListeners();
    try {
      final result = await Future.wait([
        repository.getStats(), repository.getBooks(), repository.getUsers(),
      ]);
      stats = result[0] as Map<String, dynamic>;
      books = result[1] as List<Map<String, dynamic>>;
      users = result[2] as List<Map<String, dynamic>>;
    } catch (e) { error = client.errorMessage(e); }
    loading = false; notifyListeners();
  }

  Future<bool> uploadMedia(String kind) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: kind == 'cover' ? ['jpg', 'jpeg', 'png', 'webp'] : ['mp3'],
    );
    final path = result?.files.single.path;
    if (path == null) return false;
    final maximumBytes = kind == 'cover'
        ? 5 * 1024 * 1024
        : 200 * 1024 * 1024;
    final fileSize = result!.files.single.size;
    if (fileSize > maximumBytes) {
      error = kind == 'cover'
          ? 'Cover image must be 5 MB or smaller.'
          : 'MP3 must be 200 MB or smaller.';
      notifyListeners();
      return false;
    }
    busy = true; error = null; notifyListeners();
    try {
      final media = await repository.upload(path, kind);
      if (kind == 'cover') {
        draft.coverImageUrl = media['url']?.toString() ?? '';
        draft.coverPublicId = media['publicId']?.toString() ?? '';
      } else {
        draft.introAudioUrl = media['url']?.toString() ?? '';
        draft.introAudioPublicId = media['publicId']?.toString() ?? '';
        draft.audioFileName = result.files.single.name;
        final episode = {
          'title': 'Episode 1',
          'description': '',
          'mediaUrl': draft.introAudioUrl,
          'mediaType': 'audio',
          'order': 0,
          'fileName': draft.audioFileName,
        };
        if (draft.episodes.isEmpty) {
          draft.episodes.add(episode);
        } else {
          draft.episodes[0] = episode;
        }
      }
      success = kind == 'cover' ? 'Cover uploaded' : 'MP3 uploaded';
      return true;
    } catch (e) { error = client.errorMessage(e); return false; }
    finally { busy = false; notifyListeners(); }
  }

  Future<bool> uploadEpisode() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['mp3'],
    );
    final path = result?.files.single.path;
    if (path == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final media = await repository.upload(path, 'audio');
      episodesAdd(
        title: 'Episode ${draft.episodes.length + 1}',
        mediaUrl: media['url']?.toString() ?? '',
        fileName: result!.files.single.name,
      );
      success = 'Episode uploaded';
      return true;
    } catch (e) {
      error = client.errorMessage(e);
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void episodesAdd({required String title, required String mediaUrl, required String fileName}) {
    draft.episodes.add({
      'title': title,
      'description': '',
      'mediaUrl': mediaUrl,
      'mediaType': 'audio',
      'order': draft.episodes.length,
      'fileName': fileName,
    });
    notifyListeners();
  }

  void removeEpisode(int index) {
    draft.episodes.removeAt(index);
    for (var i = 0; i < draft.episodes.length; i++) {
      draft.episodes[i]['order'] = i;
    }
    notifyListeners();
  }

  Future<bool> saveBook() async {
    if (draft.title.trim().isEmpty || draft.description.trim().isEmpty) {
      error = 'Title and description are required.'; notifyListeners(); return false;
    }
    busy = true; error = null; success = null; notifyListeners();
    try {
      if (draft.id == null) await repository.createBook(draft.toJson());
      else await repository.updateBook(draft.id!, draft.toJson());
      success = draft.id == null ? 'Book created' : 'Book updated';
      await loadAll(); return true;
    } catch (e) { error = client.errorMessage(e); return false; }
    finally { busy = false; notifyListeners(); }
  }

  Future<bool> removeBook(String id) async {
    busy = true; error = null; notifyListeners();
    try { await repository.deleteBook(id); success = 'Book deleted'; await loadAll(); return true; }
    catch (e) { error = client.errorMessage(e); return false; }
    finally { busy = false; notifyListeners(); }
  }

  Future<bool> notifyUsers(String title, String message, String target) async {
    if (title.trim().isEmpty || message.trim().isEmpty) { error = 'Enter a title and message.'; notifyListeners(); return false; }
    busy = true; error = null; notifyListeners();
    try { await repository.sendNotification(title.trim(), message.trim(), target); success = 'Notification sent'; return true; }
    catch (e) { error = client.errorMessage(e); return false; }
    finally { busy = false; notifyListeners(); }
  }

  Future<bool> changeSubscription(String id, String status) async {
    busy = true; error = null; notifyListeners();
    try { await repository.updateUserSubscription(id, status); success = 'Subscription updated'; await loadAll(); return true; }
    catch (e) { error = client.errorMessage(e); return false; }
    finally { busy = false; notifyListeners(); }
  }

  Future<bool> removeUser(String id) async {
    busy = true; error = null; notifyListeners();
    try { await repository.deleteUser(id); success = 'User deleted'; await loadAll(); return true; }
    catch (e) { error = client.errorMessage(e); return false; }
    finally { busy = false; notifyListeners(); }
  }
}
