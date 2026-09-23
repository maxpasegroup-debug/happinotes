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
    required super.priceInr,
    required super.status,
    required super.duration,
    super.episodes,
  });
  factory BookModel.fromJson(Map<String, dynamic> j) => BookModel(
    id: (j['_id'] ?? '').toString(),
    title: (j['title'] ?? '').toString(),
    description: (j['description'] ?? '').toString(),
    language: (j['language'] ?? '').toString(),
    category: (j['category'] ?? '').toString(),
    coverImageUrl: (j['coverImageUrl'] ?? j['thumbnailUrl'] ?? '').toString(),
    audioUrl: (j['introAudioUrl'] ?? '').toString(),
    accessType: (j['accessType'] ?? j['type'] ?? 'free').toString(),
    priceInr: (j['priceInr'] as num?)?.toDouble() ?? 0,
    status: (j['status'] ?? 'live').toString(),
    duration: (j['totalDurationSeconds'] as num?)?.toInt() ?? 0,
    episodes: ((j['lessons'] as List?) ?? [])
        .whereType<Map>()
        .map((lesson) => BookEpisode(
          title: (lesson['title'] ?? 'Episode').toString(),
          description: (lesson['description'] ?? '').toString(),
          audioUrl: (lesson['mediaUrl'] ?? '').toString(),
          order: (lesson['order'] as num?)?.toInt() ?? 0,
        ))
        .toList()
      ..insertAll(
        0,
        ((j['lessons'] as List?) ?? []).isEmpty && (j['introAudioUrl'] ?? '').toString().isNotEmpty
            ? [BookEpisode(title: 'Episode 1', audioUrl: (j['introAudioUrl'] ?? '').toString(), order: 0)]
            : const [],
      ),
  );
}
