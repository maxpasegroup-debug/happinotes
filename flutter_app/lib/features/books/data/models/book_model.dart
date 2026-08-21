import '../../domain/entities/book.dart';

class BookModel extends Book {
  const BookModel({
    required super.id,
    required super.title,
    required super.description,
    required super.language,
    required super.category,
    required super.coverImageUrl,
    required super.audioUrl,
    required super.accessType,
    required super.status,
    required super.duration,
    required super.episodes,
  });
  factory BookModel.fromJson(Map<String, dynamic> j) {
    final episodes = <Episode>[];
    void addSection(dynamic raw, int order, String fallback) {
      if (raw is! Map) return;
      final map = Map<String, dynamic>.from(raw);
      final url = (map['mediaUrl'] ?? '').toString();
      if (url.isEmpty || (map['mediaType'] ?? 'audio') != 'audio') return;
      episodes.add(Episode(
        id: '${j['_id'] ?? j['id']}-$order',
        title: (map['title'] ?? fallback).toString(),
        description: (map['description'] ?? '').toString(),
        audioUrl: url,
        order: order,
      ));
    }
    addSection(j['intro'], -1, 'Introduction');
    final lessons = j['lessons'] as List? ?? const [];
    for (var i = 0; i < lessons.length; i++) {
      final raw = lessons[i];
      final order = raw is Map && raw['order'] is num ? (raw['order'] as num).toInt() : i;
      addSection(raw, order, 'Episode ${i + 1}');
    }
    addSection(j['conclusion'], 1000000, 'Conclusion');
    episodes.sort((a, b) => a.order.compareTo(b.order));
    final legacyAudio = (j['introAudioUrl'] ?? '').toString();
    if (episodes.isEmpty && legacyAudio.isNotEmpty) {
      episodes.add(Episode(id: '${j['_id']}-0', title: 'Main book audio', description: '', audioUrl: legacyAudio, order: 0));
    }
    return BookModel(
    id: (j['_id'] ?? '').toString(),
    title: (j['title'] ?? '').toString(),
    description: (j['description'] ?? '').toString(),
    language: (j['language'] ?? '').toString(),
    category: (j['category'] ?? j['contentType'] ?? '').toString(),
    coverImageUrl: (j['thumbnailUrl'] ?? j['coverImageUrl'] ?? '').toString(),
    audioUrl: episodes.isEmpty ? legacyAudio : episodes.first.audioUrl,
    accessType: (j['type'] ?? j['accessType'] ?? 'free').toString(),
    status: (j['status'] ?? 'live').toString(),
    duration: (j['totalDurationSeconds'] as num?)?.toInt() ?? 0,
    episodes: episodes,
  );
  }
}
