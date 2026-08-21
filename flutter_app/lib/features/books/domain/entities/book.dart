class Episode {
  const Episode({
    required this.id,
    required this.title,
    required this.description,
    required this.audioUrl,
    required this.order,
  });
  final String id, title, description, audioUrl;
  final int order;
}

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
  final List<Episode> episodes;
}
