class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.target,
    required this.createdAt,
    this.bookId,
    this.episodeId,
    this.imageUrl,
  });

  final String id;
  final String title;
  final String message;
  final String type;
  final String target;
  final DateTime createdAt;
  final String? bookId;
  final String? episodeId;
  final String? imageUrl;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      message: (json['message'] ?? '').toString(),
      type: (json['type'] ?? 'admin').toString(),
      target: (json['target'] ?? 'all').toString(),
      bookId: json['bookId']?.toString(),
      episodeId: json['episodeId']?.toString(),
      imageUrl: json['imageUrl']?.toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}
