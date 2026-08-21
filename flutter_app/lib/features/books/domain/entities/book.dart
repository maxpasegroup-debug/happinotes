class Book {
  const Book({
    required this.id,
    required this.title,
    required this.description,
    required this.language,
    required this.category,
    required this.coverImageUrl,
    required this.audioUrl,
    required this.accessType,
    required this.status,
    required this.duration,
    this.episodes = const [],
  });
  final String id,
      title,
      description,
      language,
      category,
      coverImageUrl,
      audioUrl,
      accessType,
      status;
  final int duration;
  final List<BookEpisode> episodes;
}

class BookEpisode {
  const BookEpisode({required this.title, required this.audioUrl, this.description = '', this.order = 0});
  final String title, audioUrl, description;
  final int order;
}
