import 'package:flutter/foundation.dart';
import 'package:file_picker/file_picker.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/repositories/admin_repository.dart';

class EpisodeDraft {
  EpisodeDraft({required this.title, required this.mediaUrl, this.description = '', this.fileName = ''});
  String title;
  String description;
  String mediaUrl;
  String fileName;

  factory EpisodeDraft.fromJson(Map<String, dynamic> json) => EpisodeDraft(
    title: (json['title'] ?? 'Episode').toString(),
    description: (json['description'] ?? '').toString(),
    mediaUrl: (json['mediaUrl'] ?? '').toString(),
    fileName: (json['fileName'] ?? '').toString(),
  );
}

class BookDraft {
  String? id;
  String title = '', description = '', language = 'english';
  String status = 'draft', accessType = 'free';
  String coverImageUrl = '';
  String sortOrder = '0';
  bool featured = false;
  List<EpisodeDraft> episodes = [];

  BookDraft();
  BookDraft.fromJson(Map<String, dynamic> j) {
    id = j['_id']?.toString();
    title = (j['title'] ?? '').toString();
    description = (j['description'] ?? '').toString();
    language = (j['language'] ?? 'english').toString();
    status = (j['status'] ?? 'draft').toString();
    accessType = (j['type'] ?? j['accessType'] ?? 'free').toString();
    coverImageUrl = (j['thumbnailUrl'] ?? j['coverImageUrl'] ?? '').toString();
    sortOrder = (j['mobileDisplayOrder'] ?? j['sortOrder'] ?? 0).toString();
    featured = j['featured'] == true || j['isFeatured'] == true;
    final raw = (j['lessons'] as List?) ?? const [];
    episodes = raw.map((e) => EpisodeDraft.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Map<String, dynamic> toJson() => {
    'title': title.trim(),
    'description': description.trim(),
    'language': language,
    'contentType': 'lifebook',
    'status': status,
    'type': accessType,
    'thumbnailUrl': coverImageUrl,
    'mobileDisplayOrder': int.tryParse(sortOrder) ?? 0,
    'webDisplayOrder': int.tryParse(sortOrder) ?? 0,
    'featured': featured,
    'lessons': episodes.asMap().entries.map((entry) => {
      'title': entry.value.title.trim(),
      'description': entry.value.description.trim(),
      'mediaUrl': entry.value.mediaUrl,
      'mediaType': 'audio',
      'order': entry.key,
    }).toList(),
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

  Future<PlatformFile?> _pick(String kind) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: kind == 'cover' ? ['jpg', 'jpeg', 'png', 'webp'] : ['mp3'],
    );
    final file = result?.files.single;
    final path = file?.path;
    if (path == null || file == null) return null;
    final maximumBytes = kind == 'cover'
        ? 5 * 1024 * 1024
        : 200 * 1024 * 1024;
    if (file.size > maximumBytes) {
      error = kind == 'cover'
          ? 'Cover image must be 5 MB or smaller.'
          : 'MP3 must be 200 MB or smaller.';
      notifyListeners();
      return null;
    }
    return file;
  }

  Future<bool> uploadCover() async {
    final file = await _pick('cover');
    if (file?.path == null) return false;
    busy = true; error = null; notifyListeners();
    try {
      final media = await repository.upload(file!.path!, 'thumbnail');
      draft.coverImageUrl = media['url']?.toString() ?? '';
      success = 'Cover uploaded';
      return true;
    } catch (e) { error = client.errorMessage(e); return false; }
    finally { busy = false; notifyListeners(); }
  }

  Future<bool> addEpisode() async {
    final file = await _pick('audio');
    if (file?.path == null) return false;
    busy = true; error = null; notifyListeners();
    try {
      final media = await repository.upload(file!.path!, 'lesson');
      draft.episodes.add(EpisodeDraft(
        title: 'Episode ${draft.episodes.length + 1}',
        mediaUrl: media['url']?.toString() ?? '',
        fileName: file.name,
      ));
      success = 'Episode uploaded';
      return true;
    } catch (e) { error = client.errorMessage(e); return false; }
    finally { busy = false; notifyListeners(); }
  }

  void removeEpisode(int index) { draft.episodes.removeAt(index); notifyListeners(); }
  void moveEpisode(int index, int delta) {
    final next = index + delta;
    if (next < 0 || next >= draft.episodes.length) return;
    final episode = draft.episodes.removeAt(index);
    draft.episodes.insert(next, episode);
    notifyListeners();
  }

  Future<bool> saveBook() async {
    if (draft.title.trim().isEmpty || draft.description.trim().isEmpty || draft.coverImageUrl.isEmpty) {
      error = 'Title, description and cover image are required.'; notifyListeners(); return false;
    }
    if (draft.status == 'live' && draft.episodes.isEmpty) {
      error = 'Add at least one episode before publishing.'; notifyListeners(); return false;
    }
    busy = true; error = null; success = null; notifyListeners();
    try {
      if (draft.id == null) {
        await repository.createBook(draft.toJson());
      } else {
        await repository.updateBook(draft.id!, draft.toJson());
        await repository.updateBookStatus(draft.id!, draft.status);
      }
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
