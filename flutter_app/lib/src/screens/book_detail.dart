import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/books/domain/entities/book.dart';
import '../theme.dart';
import '../widgets/app_message.dart';
import '../widgets/loading_skeleton.dart';
import 'episode_player_screen.dart';

class BookDetail extends ConsumerWidget {
  const BookDetail({super.key, required this.book});
  final Book book;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final player = ref.watch(playerControllerProvider);
    final user = ref.watch(sessionControllerProvider).user;
    final requiresPurchase = !(user?.hasActiveSubscription ?? false) &&
        !((user?.purchasedBookIds.contains(book.id)) ?? false) &&
        (book.priceInr > 0 || book.accessType == 'premium');

    return StreamBuilder<bool>(
      stream: player.audioPlayer.playingStream,
      initialData: player.audioPlayer.playing,
      builder: (context, snapshot) {
        final isPlaying =
            player.currentBook?.id == book.id && (snapshot.data ?? false);

        Future<void> handlePlayback() async {
          if (requiresPurchase) {
            await _purchaseBook(context, ref, book);
            return;
          }
          try {
            if (isPlaying) {
              await player.stop();
            } else {
              await player.play(book);
            }
          } catch (error) {
            if (context.mounted) {
              AppMessage.show(context, error.toString(), success: false);
            }
          }
        }

        return Scaffold(
    body: CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 360,
          pinned: true,
          backgroundColor: AppColors.background,
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(
              fit: StackFit.expand,
              children: [
                if (book.coverImageUrl.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: book.coverImageUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => const SkeletonBox(
                      height: double.infinity,
                      radius: 0,
                    ),
                    color: Colors.black.withValues(alpha: .38),
                    colorBlendMode: BlendMode.darken,
                  ),
                Center(
                  child: Hero(
                    tag: 'book-${book.id}',
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final coverWidth = (MediaQuery.sizeOf(context).width * .42)
                            .clamp(128.0, 175.0);
                        return Container(
                          width: coverWidth,
                          height: coverWidth * 1.4,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: const [
                              BoxShadow(color: Colors.black54, blurRadius: 24),
                            ],
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: book.coverImageUrl.isEmpty
                              ? ColoredBox(color: Theme.of(context).colorScheme.surfaceContainerHighest)
                              : CachedNetworkImage(
                                  imageUrl: book.coverImageUrl,
                                  fit: BoxFit.cover,
                                  placeholder: (_, _) => const SkeletonBox(
                                    height: double.infinity,
                                    radius: 14,
                                  ),
                                ),
                        );
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 120),
          sliver: SliverList.list(
            children: [
              Text(
                book.title,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                '${book.language.toUpperCase()}  •  ${book.category}  •  ${book.accessType}',
                style: const TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 22),
              Text(
                book.description,
                style: const TextStyle(height: 1.55, fontSize: 15),
              ),
              const SizedBox(height: 28),
              if (book.episodes.isNotEmpty) ...[
                const SizedBox(height: 18),
                Text(
                  '${book.episodes.length} episodes available',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                ...book.episodes.asMap().entries.map((entry) {
                  final episode = entry.value;
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    onTap: () async {
                      if (requiresPurchase || episode.audioUrl.isEmpty) {
                        AppMessage.show(context, requiresPurchase ? 'Purchase this story to listen.' : 'This episode is not available yet.', success: false);
                        return;
                      }
                      try {
                        if (!context.mounted) return;
                        Navigator.of(context).push(MaterialPageRoute(builder: (_) => EpisodePlayerScreen(book: book, episode: episode)));
                        // Start loading after navigation so the player screen appears immediately.
                        await player.playEpisode(book, episode);
                      } catch (error) {
                        if (context.mounted) AppMessage.show(context, error.toString(), success: false);
                      }
                    },
                    leading: CircleAvatar(
                      backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                      child: Text('${entry.key + 1}'),
                    ),
                    title: Text(episode.title),
                    subtitle: (isPlaying && player.currentEpisode == episode)
                        ? const Text('Playing now', style: TextStyle(color: AppColors.coral, fontWeight: FontWeight.w700))
                        : (episode.description.isEmpty
                            ? null
                            : Text(episode.description, maxLines: 2, overflow: TextOverflow.ellipsis)),
                    trailing: IconButton(
                      icon: Icon(
                        requiresPurchase || episode.audioUrl.isEmpty
                            ? Icons.lock_rounded
                            : isPlaying && player.currentEpisode == episode
                            ? Icons.stop_rounded
                            : Icons.play_arrow_rounded,
                        color: requiresPurchase || episode.audioUrl.isEmpty
                            ? AppColors.muted
                            : AppColors.coral,
                      ),
                      onPressed: () async {
                        if (requiresPurchase || episode.audioUrl.isEmpty) {
                          AppMessage.show(context, requiresPurchase ? 'Purchase this story to listen.' : 'This episode is not available yet.', success: false);
                          return;
                        }
                        try {
                        if (isPlaying && player.currentEpisode == episode) {
                          await player.stop();
                        } else {
                          if (!context.mounted) return;
                          Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => EpisodePlayerScreen(book: book, episode: episode),
                          ));
                          await player.playEpisode(book, episode);
                        }
                        } catch (error) {
                          if (context.mounted) AppMessage.show(context, error.toString(), success: false);
                        }
                      },
                    ),
                  );
                }),
              ],
            ],
          ),
        ),
      ],
    ),
    bottomNavigationBar: SafeArea(
      minimum: const EdgeInsets.all(16),
      child: FilledButton.icon(
        onPressed: requiresPurchase
            ? handlePlayback
            : (book.audioUrl.isEmpty && book.episodes.isEmpty)
            ? null
            : handlePlayback,
        icon: Icon(
          isPlaying ? Icons.stop_rounded : Icons.play_arrow_rounded,
        ),
        label: Text(requiresPurchase
            ? (book.priceInr > 0 ? 'Buy for INR ${book.priceInr.toStringAsFixed(0)}' : 'Price unavailable')
            : (isPlaying ? 'Stop listening' : 'Start listening')),
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.coral,
          padding: const EdgeInsets.all(17),
        ),
      ),
    ),
        );
      },
    );
  }
}

Future<void> _purchaseBook(BuildContext context, WidgetRef ref, Book book) async {
  if (book.priceInr <= 0) {
    AppMessage.show(context, 'This story has no price yet. Please ask the admin to set one.', success: false);
    return;
  }
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text('Buy ${book.title}?'),
      content: Text('One-time purchase · INR ${book.priceInr.toStringAsFixed(0)}\nYou will unlock every episode in this story.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Purchase')),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;
  final controller = ref.read(booksControllerProvider);
  final ids = await controller.purchaseBook(book);
  if (!context.mounted) return;
  if (ids == null) {
    AppMessage.show(context, controller.error ?? 'Purchase failed', success: false);
    return;
  }
  ref.read(sessionControllerProvider).updatePurchasedBooks(ids);
  await controller.loadBooks(forceRefresh: true);
  if (!context.mounted) return;
  final matches = controller.books.where((item) => item.id == book.id);
  final updated = matches.isEmpty ? null : matches.first;
  if (updated != null) {
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => BookDetail(book: updated)));
  } else {
    AppMessage.show(context, 'Story purchased successfully. Reopen it to listen.', success: true);
  }
}
