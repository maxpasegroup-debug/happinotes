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
  });
  factory BookModel.fromJson(Map<String, dynamic> j) => BookModel(
    id: (j['_id'] ?? '').toString(),
    title: (j['title'] ?? '').toString(),
    description: (j['description'] ?? '').toString(),
    language: (j['language'] ?? '').toString(),
    category: (j['category'] ?? '').toString(),
    coverImageUrl: (j['coverImageUrl'] ?? '').toString(),
    audioUrl: (j['introAudioUrl'] ?? '').toString(),
    accessType: (j['accessType'] ?? 'free').toString(),
    status: (j['status'] ?? 'live').toString(),
    duration: (j['totalDurationSeconds'] as num?)?.toInt() ?? 0,
  );
}
