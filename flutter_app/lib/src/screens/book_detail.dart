import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/books/domain/entities/book.dart';
import '../theme.dart';
import '../widgets/app_message.dart';
import '../widgets/loading_skeleton.dart';
import 'episode_player_screen.dart';
import 'subscription_screen.dart';

class BookDetail extends ConsumerStatefulWidget {
  const BookDetail({super.key, required Book book}) : initialBook = book;
  final Book initialBook;

  @override
  ConsumerState<BookDetail> createState() => _BookDetailState();
}

class _BookDetailState extends ConsumerState<BookDetail> {
  double _edgeDragDistance = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      if (!mounted) return;
      final session = ref.read(sessionControllerProvider);
      try {
        await session.refreshUser();
      } catch (_) {
        // Keep previously verified ownership while offline; never grant new access.
      }
      if (!mounted) return;
      final book = widget.initialBook;
      if ((book.priceInr > 0 || book.accessType == 'premium') &&
          !(session.user?.purchasedBookIds.contains(book.id) ?? false) &&
          !(session.user?.subscriptionActive ?? false)) {
        final subscriptions = ref.read(subscriptionPurchaseControllerProvider);
        subscriptions.setUser(session.user?.id);
        await subscriptions.reload();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final player = ref.watch(playerControllerProvider);
    final user = ref.watch(sessionControllerProvider).user;
    final booksState = ref.watch(booksControllerProvider);
    // Realtime catalogue updates replace the controller's book instance. Use
    // that latest instance so newly saved episodes appear while this screen is
    // already open instead of only after a manual refresh.
    var book = widget.initialBook;
    for (final updated in ref.watch(booksControllerProvider).books) {
      if (updated.id == widget.initialBook.id) {
        book = updated;
        break;
      }
    }
    final isPurchased = (user?.purchasedBookIds.contains(book.id)) ?? false;
    final hasSubscription = user?.subscriptionActive == true;
    final requiresPurchase =
        !isPurchased &&
        !hasSubscription &&
        (book.priceInr > 0 || book.accessType == 'premium');

    return StreamBuilder<bool>(
      stream: player.audioPlayer.playingStream,
      initialData: player.audioPlayer.playing,
      builder: (context, snapshot) {
        final isPlaying =
            player.currentBook?.id == book.id && (snapshot.data ?? false);

        Future<void> handlePlayback() async {
          if (requiresPurchase) {
            final session = ref.read(sessionControllerProvider);
            try {
              await session.refreshUser();
            } catch (error) {
              if (context.mounted) {
                AppMessage.show(
                  context,
                  ref.read(apiClientProvider).errorMessage(error),
                  success: false,
                );
              }
              return;
            }
            if (!context.mounted) return;
            if (session.user?.purchasedBookIds.contains(book.id) ?? false) {
              return;
            }
            if (session.user?.subscriptionActive ?? false) {
              return;
            }
            if (session.user == null) {
              AppMessage.show(
                context,
                'Sign in to subscribe.',
                success: false,
              );
              return;
            }
            await _openStoreCheckout(context);
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

        return NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            // Dismiss only after the scroll is already at the very top and
            // the user deliberately pulls down far enough. This avoids
            // closing the page during normal episode-list scrolling.
            if (notification is OverscrollNotification &&
                notification.metrics.pixels <=
                    notification.metrics.minScrollExtent &&
                notification.overscroll < 0) {
              _edgeDragDistance += -notification.overscroll;
              if (_edgeDragDistance >= 120 && context.mounted) {
                _edgeDragDistance = 0;
                Navigator.of(context).maybePop();
              }
            } else if (notification is ScrollEndNotification) {
              _edgeDragDistance = 0;
            }
            return false;
          },
          child: Scaffold(
            body: CustomScrollView(
              slivers: [
                SliverAppBar(
                  expandedHeight: 360,
                  pinned: true,
                  // Once the cover collapses, keep the pinned toolbar in the
                  // current theme instead of exposing a black strip below it.
                  backgroundColor: Theme.of(context).colorScheme.surface,
                  foregroundColor: Theme.of(context).colorScheme.onSurface,
                  surfaceTintColor: Colors.transparent,
                  leading: IconButton(
                    icon: const Icon(Icons.arrow_back_rounded),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  actions: [
                    IconButton(
                      tooltip:
                          booksState.library.any((item) => item.id == book.id)
                          ? 'Remove from library'
                          : 'Save to library',
                      icon: Icon(
                        booksState.library.any((item) => item.id == book.id)
                            ? Icons.bookmark_rounded
                            : Icons.bookmark_border_rounded,
                      ),
                      onPressed: () async {
                        final saved = booksState.library.any(
                          (item) => item.id == book.id,
                        );
                        final error = saved
                            ? await ref
                                  .read(booksControllerProvider)
                                  .removeFromCollection(book)
                            : await ref
                                  .read(booksControllerProvider)
                                  .addToCollection(book);
                        if (context.mounted) {
                          AppMessage.show(
                            context,
                            error ??
                                (saved
                                    ? 'Removed from your library'
                                    : 'Saved to your library'),
                            success: error == null,
                          );
                        }
                      },
                    ),
                  ],
                  // Fade the cover out as the sliver collapses. The app bar remains
                  // pinned, while the episode list takes over the screen smoothly.
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.parallax,
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
                                final coverWidth =
                                    (MediaQuery.sizeOf(context).width * .42)
                                        .clamp(128.0, 175.0);
                                return Container(
                                  width: coverWidth,
                                  height: coverWidth * 1.4,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(14),
                                    boxShadow: const [
                                      BoxShadow(
                                        color: Colors.black54,
                                        blurRadius: 24,
                                      ),
                                    ],
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: book.coverImageUrl.isEmpty
                                      ? ColoredBox(
                                          color: Theme.of(
                                            context,
                                          ).colorScheme.surfaceContainerHighest,
                                        )
                                      : CachedNetworkImage(
                                          imageUrl: book.coverImageUrl,
                                          fit: BoxFit.cover,
                                          placeholder: (_, _) =>
                                              const SkeletonBox(
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
                        '${book.language.toUpperCase()} \u2022 ${book.accessType == 'premium' ? 'Premium' : 'Free'}',
                        style: const TextStyle(color: AppColors.muted),
                      ),
                      const SizedBox(height: 14),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isPurchased || hasSubscription
                                ? AppColors.success.withValues(alpha: .12)
                                : requiresPurchase
                                ? AppColors.coral.withValues(alpha: .12)
                                : AppColors.success.withValues(alpha: .12),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: isPurchased || hasSubscription
                                  ? AppColors.success.withValues(alpha: .35)
                                  : requiresPurchase
                                  ? AppColors.coral.withValues(alpha: .35)
                                  : AppColors.success.withValues(alpha: .35),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isPurchased || hasSubscription
                                    ? Icons.verified_rounded
                                    : requiresPurchase
                                    ? Icons.sell_outlined
                                    : Icons.check_circle_outline,
                                size: 17,
                                color: isPurchased || hasSubscription
                                    ? AppColors.success
                                    : requiresPurchase
                                    ? AppColors.coral
                                    : AppColors.success,
                              ),
                              const SizedBox(width: 7),
                              Text(
                                isPurchased
                                    ? 'Purchased'
                                    : hasSubscription
                                    ? 'Subscribed'
                                    : requiresPurchase
                                    ? 'Subscription required'
                                    : 'Free',
                                style: TextStyle(
                                  color: !requiresPurchase
                                      ? AppColors.success
                                      : AppColors.coral,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (requiresPurchase) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.coral.withValues(alpha: .12),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: AppColors.coral.withValues(alpha: .35),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.lock_outline_rounded,
                                color: AppColors.coral,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Premium story \u2022 A monthly or yearly subscription unlocks all premium stories.',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
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
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ...book.episodes.asMap().entries.map((entry) {
                          final episode = entry.value;
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            onTap: () async {
                              if (requiresPurchase ||
                                  episode.audioUrl.isEmpty) {
                                AppMessage.show(
                                  context,
                                  requiresPurchase
                                      ? 'Subscribe to listen to this story.'
                                      : 'This episode is not available yet.',
                                  success: false,
                                );
                                return;
                              }
                              try {
                                if (!context.mounted) return;
                                Navigator.of(context).push(
                                  _slideUpPageRoute(
                                    EpisodePlayerScreen(
                                      book: book,
                                      episode: episode,
                                    ),
                                  ),
                                );
                                // Start loading after navigation so the player screen appears immediately.
                                await player.playEpisode(book, episode);
                              } catch (error) {
                                if (context.mounted)
                                  AppMessage.show(
                                    context,
                                    error.toString(),
                                    success: false,
                                  );
                              }
                            },
                            leading: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: book.coverImageUrl.isEmpty
                                  ? Container(
                                      width: 52,
                                      height: 64,
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.surfaceContainerHighest,
                                      alignment: Alignment.center,
                                      child: Text('${entry.key + 1}'),
                                    )
                                  : CachedNetworkImage(
                                      imageUrl: book.coverImageUrl,
                                      width: 52,
                                      height: 64,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, __, ___) => Container(
                                        color: Theme.of(
                                          context,
                                        ).colorScheme.surfaceContainerHighest,
                                        width: 52,
                                        height: 64,
                                        alignment: Alignment.center,
                                        child: Text('${entry.key + 1}'),
                                      ),
                                    ),
                            ),
                            title: Text(episode.title),
                            subtitle:
                                (isPlaying && player.currentEpisode == episode)
                                ? const Text(
                                    'Playing now',
                                    style: TextStyle(
                                      color: AppColors.coral,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  )
                                : (episode.description.isEmpty
                                      ? null
                                      : Text(
                                          episode.description,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        )),
                            trailing: IconButton(
                              icon: Icon(
                                requiresPurchase || episode.audioUrl.isEmpty
                                    ? Icons.lock_rounded
                                    : isPlaying &&
                                          player.currentEpisode == episode
                                    ? Icons.stop_rounded
                                    : Icons.play_arrow_rounded,
                                color:
                                    requiresPurchase || episode.audioUrl.isEmpty
                                    ? AppColors.muted
                                    : AppColors.coral,
                              ),
                              onPressed: () async {
                                if (requiresPurchase ||
                                    episode.audioUrl.isEmpty) {
                                  AppMessage.show(
                                    context,
                                    requiresPurchase
                                        ? 'Subscribe to listen to this story.'
                                        : 'This episode is not available yet.',
                                    success: false,
                                  );
                                  return;
                                }
                                try {
                                  if (isPlaying &&
                                      player.currentEpisode == episode) {
                                    await player.stop();
                                  } else {
                                    if (!context.mounted) return;
                                    Navigator.of(context).push(
                                      _slideUpPageRoute(
                                        EpisodePlayerScreen(
                                          book: book,
                                          episode: episode,
                                        ),
                                      ),
                                    );
                                    await player.playEpisode(book, episode);
                                  }
                                } catch (error) {
                                  if (context.mounted)
                                    AppMessage.show(
                                      context,
                                      error.toString(),
                                      success: false,
                                    );
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
                label: Text(
                  requiresPurchase
                      ? 'View plans'
                      : (isPlaying ? 'Stop listening' : 'Start listening'),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.coral,
                  padding: const EdgeInsets.all(17),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

Route<void> _slideUpPageRoute(Widget page) => PageRouteBuilder<void>(
  pageBuilder: (_, __, ___) => page,
  transitionDuration: const Duration(milliseconds: 320),
  reverseTransitionDuration: const Duration(milliseconds: 260),
  transitionsBuilder: (_, animation, __, child) => SlideTransition(
    position: Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).chain(CurveTween(curve: Curves.easeOutCubic)).animate(animation),
    child: child,
  ),
);

Future<bool?> _openStoreCheckout(BuildContext context) {
  return Navigator.of(context).push<bool>(
    MaterialPageRoute<bool>(builder: (_) => const SubscriptionScreen()),
  );
}
