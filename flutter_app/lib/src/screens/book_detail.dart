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
  const BookDetail({super.key, required Book book}) : initialBook = book;
  final Book initialBook;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final player = ref.watch(playerControllerProvider);
    final user = ref.watch(sessionControllerProvider).user;
    // Realtime catalogue updates replace the controller's book instance. Use
    // that latest instance so newly saved episodes appear while this screen is
    // already open instead of only after a manual refresh.
    var book = initialBook;
    for (final updated in ref.watch(booksControllerProvider).books) {
      if (updated.id == initialBook.id) {
        book = updated;
        break;
      }
    }
    final requiresPurchase =
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
          // Use a regular flexible-space child instead of FlexibleSpaceBar.
          // FlexibleSpaceBar fades its background as it collapses, which left
          // the pinned header showing only the (black) app-bar background.
          // Keeping the image in the stack makes it remain visible while the
          // episode list is scrolled.
          flexibleSpace: Stack(
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
              // Keep toolbar controls readable over light cover images.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.black54, Colors.transparent],
                    stops: [0, .35],
                  ),
                ),
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
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Price', style: TextStyle(fontWeight: FontWeight.w700)),
                    Text(
                      book.priceInr > 0 ? 'INR ${book.priceInr.toStringAsFixed(0)}' : 'Free',
                      style: TextStyle(
                        color: book.priceInr > 0 ? AppColors.coral : AppColors.success,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              if (requiresPurchase) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.coral.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.coral.withValues(alpha: .35)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.lock_outline_rounded, color: AppColors.coral),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Premium story • One-time purchase required to unlock all episodes.',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
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
                    leading: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: book.coverImageUrl.isEmpty
                          ? Container(
                              width: 52,
                              height: 64,
                              color: Theme.of(context).colorScheme.surfaceContainerHighest,
                              alignment: Alignment.center,
                              child: Text('${entry.key + 1}'),
                            )
                          : CachedNetworkImage(
                              imageUrl: book.coverImageUrl,
                              width: 52,
                              height: 64,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => Container(
                                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                width: 52,
                                height: 64,
                                alignment: Alignment.center,
                                child: Text('${entry.key + 1}'),
                              ),
                            ),
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

class BookPurchaseCheckoutScreen extends ConsumerStatefulWidget {
  const BookPurchaseCheckoutScreen({super.key, required this.book});

  final Book book;

  @override
  ConsumerState<BookPurchaseCheckoutScreen> createState() =>
      _BookPurchaseCheckoutScreenState();
}

class _BookPurchaseCheckoutScreenState
    extends ConsumerState<BookPurchaseCheckoutScreen> {
  bool _submitting = false;

  Future<void> _proceed() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    final controller = ref.read(booksControllerProvider);
    final ids = await controller.purchaseBook(widget.book);
    if (!mounted) return;
    if (ids == null) {
      setState(() => _submitting = false);
      AppMessage.show(context, controller.error ?? 'Payment failed', success: false);
      return;
    }
    ref.read(sessionControllerProvider).updatePurchasedBooks(ids);
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final book = widget.book;
    return Scaffold(
      appBar: AppBar(title: const Text('Confirm purchase')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.lock_open_rounded, size: 64, color: AppColors.coral),
              const SizedBox(height: 20),
              Text(book.title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 12),
              Text(
                'Unlock every episode in this premium story with a one-time payment.',
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .bodyLarge
                    ?.copyWith(color: AppColors.muted),
              ),
              const SizedBox(height: 24),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total', style: TextStyle(fontWeight: FontWeight.w700)),
                      Text('INR ${book.priceInr.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                    ],
                  ),
                ),
              ),
              const Spacer(),
              OutlinedButton(
                onPressed: _submitting ? null : () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              const SizedBox(height: 10),
              FilledButton(
                onPressed: _submitting ? null : _proceed,
                child: Text(_submitting ? 'Processing...' : 'Proceed to pay'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _purchaseBook(BuildContext context, WidgetRef ref, Book book) async {
  if (book.priceInr <= 0) {
    AppMessage.show(context, 'This story has no price yet. Please ask the admin to set one.', success: false);
    return;
  }
  final confirmed = await Navigator.of(context).push<bool>(
    MaterialPageRoute(builder: (_) => BookPurchaseCheckoutScreen(book: book)),
    /*
      title: Text('Buy ${book.title}?'),
      content: Text('One-time purchase · INR ${book.priceInr.toStringAsFixed(0)}\nYou will unlock every episode in this story.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Purchase')),
      ],
    */
  );
  if (confirmed != true || !context.mounted) return;
  final controller = ref.read(booksControllerProvider);
  await controller.loadBooks(forceRefresh: true);
  if (!context.mounted) return;
  final matches = controller.books.where((item) => item.id == book.id);
  final updated = matches.isEmpty ? null : matches.first;
  if (updated != null) {
    AppMessage.show(context, 'Payment successful. Story unlocked.', success: true);
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => BookDetail(book: updated)));
  } else {
    AppMessage.show(context, 'Story purchased successfully. Reopen it to listen.', success: true);
  }
}
