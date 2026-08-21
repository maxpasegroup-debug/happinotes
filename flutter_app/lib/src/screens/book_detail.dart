import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/books/domain/entities/book.dart';
import '../theme.dart';
import '../widgets/app_message.dart';
import 'player_screen.dart';

class BookDetail extends ConsumerWidget {
  const BookDetail({super.key, required this.book});
  final Book book;

  Future<void> _play(BuildContext context, WidgetRef ref, Episode episode) async {
    try {
      await ref.read(playerControllerProvider).playEpisode(book, episode);
      if (context.mounted) {
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlayerScreen()));
      }
    } catch (error) {
      if (context.mounted) AppMessage.show(context, error.toString(), success: false);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final player = ref.watch(playerControllerProvider);
    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverAppBar(
          expandedHeight: 340,
          pinned: true,
          backgroundColor: AppColors.background,
          flexibleSpace: FlexibleSpaceBar(
            background: Center(
              child: Hero(
                tag: 'book-${book.id}',
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: book.coverImageUrl.isEmpty
                      ? const ColoredBox(color: AppColors.raised, child: SizedBox(width: 180, height: 250))
                      : CachedNetworkImage(imageUrl: book.coverImageUrl, width: 180, height: 250, fit: BoxFit.cover),
                ),
              ),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
          sliver: SliverList.list(children: [
            Text(book.title, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text('${book.language.toUpperCase()} • ${book.accessType}', style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 20),
            Text(book.description, style: const TextStyle(height: 1.55, fontSize: 15)),
            const SizedBox(height: 28),
            Text('${book.episodes.length} Episodes', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            if (book.episodes.isEmpty)
              const Card(child: Padding(padding: EdgeInsets.all(18), child: Text('Episodes are coming soon.'))),
            ...book.episodes.asMap().entries.map((entry) {
              final episode = entry.value;
              final selected = player.currentBook?.id == book.id && player.currentEpisode?.id == episode.id;
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  leading: CircleAvatar(
                    backgroundColor: selected ? AppColors.coral : AppColors.raised,
                    child: Icon(selected ? Icons.graphic_eq_rounded : Icons.play_arrow_rounded, color: selected ? Colors.white : AppColors.coral),
                  ),
                  title: Text(episode.title, style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: episode.description.isEmpty ? Text('Episode ${entry.key + 1}') : Text(episode.description, maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => _play(context, ref, episode),
                ),
              );
            }),
          ]),
        ),
      ]),
    );
  }
}
