import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/auth/presentation/controllers/session_controller.dart';
import '../../features/books/domain/entities/book.dart';
import '../theme.dart';
import '../widgets/app_message.dart';
import '../widgets/book_card.dart';
import '../widgets/loading_skeleton.dart';
import 'book_detail.dart';
import 'episode_player_screen.dart';
import 'legal_screen.dart';

class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(booksControllerProvider).loadCollection();
    });
  }

  @override
  Widget build(BuildContext context) {
    final index = ref.watch(mainTabIndexProvider);
    final books = ref.watch(booksControllerProvider);
    if (!books.loading &&
        books.books.isEmpty &&
        books.upcoming.isEmpty &&
        books.error == null) {
      Future.microtask(() => ref.read(booksControllerProvider).loadBooks());
    }
    final pages = [
      const HomeTab(),
      const CollectionTab(),
      const ProfileTab(),
    ];
    return Scaffold(
      body: pages[index],
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const MiniPlayer(),
          NavigationBar(
            selectedIndex: index,
            onDestinationSelected: (value) {
              ref.read(mainTabIndexProvider.notifier).state = value;
              if (value == 1) {
                ref.read(booksControllerProvider).loadCollection(forceRefresh: true);
              }
            },
            backgroundColor: Theme.of(context).colorScheme.surface,
            indicatorColor: AppColors.coral.withValues(alpha: .2),
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Home',
              ),
              NavigationDestination(
                icon: Icon(Icons.bookmark_outline),
                selectedIcon: Icon(Icons.bookmark),
                label: 'Library',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline),
                selectedIcon: Icon(Icons.person),
                label: 'Profile',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});
  @override
  Widget build(BuildContext context) => Consumer(
    builder: (context, ref, child) {
      final s = ref.watch(booksControllerProvider);
      final preference = ref.watch(sessionControllerProvider).user?.languagePreference ?? 'all';
      final books = preference == 'all'
          ? s.books
          : s.books.where((book) => book.language.toLowerCase() == preference.toLowerCase()).toList();
      final upcoming = preference == 'all'
          ? s.upcoming
          : s.upcoming.where((book) => book.language.toLowerCase() == preference.toLowerCase()).toList();
      return SafeArea(
        child: RefreshIndicator(
          onRefresh: () => s.loadBooks(forceRefresh: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.coral,
                    radius: 24,
                    child: const Icon(Icons.headphones, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'HappiNotes',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          'Listen. Learn. Feel better.',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => const _DemoNotificationsSheet(),
                    ),
                    icon: const Icon(Icons.notifications_none),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Material(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SearchTab()),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                child: TextField(
                  readOnly: true,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SearchTab()),
                  ),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search_rounded),
                    hintText: 'Search books and stories',
                    fillColor: Colors.transparent,
                    border: InputBorder.none,
                  ),
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                ),
                  ),
                ),
              ),
              const SizedBox(height: 22),
              if (s.loading)
                const HomeLoadingSkeleton()
              else if (s.error != null)
                _InlineState(
                  icon: Icons.cloud_off_rounded,
                  title: 'Couldn’t load stories',
                  message: s.error!,
                  action: TextButton.icon(
                    onPressed: () => s.loadBooks(forceRefresh: true),
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Try again'),
                  ),
                )
              else if (books.isEmpty && upcoming.isEmpty)
                const _InlineState(
                  icon: Icons.auto_stories_outlined,
                  title: 'Your next story is on its way',
                  message: 'New audio stories will appear here.',
                )
              else if (books.isNotEmpty) ...[
                FeaturedRail(books: books),
                const SizedBox(height: 28),
                const SectionTitle('Recently added'),
                const SizedBox(height: 12),
                SizedBox(
                  height: BookCard.shelfHeight(context),
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: books.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(width: 12),
                    itemBuilder: (_, i) => BookCard(
                      book: books[i],
                      onTap: () => openBook(context, books[i]),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                const SectionTitle('Free to listen'),
                const SizedBox(height: 12),
                SizedBox(
                  height: BookCard.shelfHeight(context),
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: books
                        .where((b) => b.accessType == 'free')
                        .length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(width: 12),
                    itemBuilder: (_, i) {
                      final b = books
                          .where((x) => x.accessType == 'free')
                          .elementAt(i);
                      return BookCard(
                        book: b,
                        onTap: () => openBook(context, b),
                      );
                    },
                  ),
                ),
              ],
              if (!s.loading && upcoming.isNotEmpty) ...[
                const SizedBox(height: 24),
                const SectionTitle('Coming soon'),
                const SizedBox(height: 6),
                const Text(
                  'New audiobooks being prepared for release.',
                  style: TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: BookCard.shelfHeight(context),
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: upcoming.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (_, index) {
                      final book = upcoming[index];
                      return BookCard(
                        book: book,
                        onTap: () => AppMessage.show(
                          context,
                          '${book.title} is coming soon',
                        ),
                      );
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    },
  );
}

class FeaturedRail extends StatefulWidget {
  const FeaturedRail({super.key, required this.books});
  final List<Book> books;

  @override
  State<FeaturedRail> createState() => _FeaturedRailState();
}

class _FeaturedRailState extends State<FeaturedRail> {
  late final PageController _controller;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController(viewportFraction: .73);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final viewport = MediaQuery.sizeOf(context);
    final railHeight = (viewport.width * .95).clamp(300.0, 374.0);
    return Column(
    children: [
      SizedBox(
        height: railHeight,
        child: PageView.builder(
          controller: _controller,
          itemCount: widget.books.length,
          onPageChanged: (value) => setState(() => _index = value),
          itemBuilder: (context, index) {
            final book = widget.books[index];
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: InkWell(
                borderRadius: BorderRadius.circular(24),
                onTap: () => openBook(context, book),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _cover(book),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.transparent, Color(0xE6000000)],
                            stops: [.5, 1],
                          ),
                        ),
                      ),
                      Positioned(
                        top: 14,
                        right: 14,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: .45),
                            shape: BoxShape.circle,
                          ),
                          child: Consumer(
                            builder: (context, ref, _) {
                              final saved = ref.watch(booksControllerProvider)
                                  .library
                                  .any((item) => item.id == book.id);
                              return IconButton(
                              visualDensity: VisualDensity.compact,
                              color: saved ? AppColors.coral : Colors.white,
                              icon: Icon(
                                saved
                                    ? Icons.bookmark_rounded
                                    : Icons.bookmark_border_rounded,
                              ),
                              onPressed: () async {
                                final controller = ref.read(booksControllerProvider);
                                final message = saved
                                    ? await controller.removeFromCollection(book)
                                    : await controller.addToCollection(book);
                                if (!context.mounted) return;
                                AppMessage.show(
                                  context,
                                  message ??
                                      (saved
                                          ? 'Removed from your library'
                                          : 'Added to your library'),
                                  success: message == null,
                                );
                              },
                            );
                            },
                          ),
                        ),
                      ),
                      Positioned(
                        left: 18,
                        right: 18,
                        bottom: 18,
                        child: Text(
                          book.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 24,
                            height: 1.05,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
      const SizedBox(height: 12),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(widget.books.length.clamp(1, 6).toInt(), (dot) {
          final active = dot == _index.clamp(0, 5).toInt();
          return AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: active ? 42 : 8,
            height: 8,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(
              color: active
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.outline,
              borderRadius: BorderRadius.circular(10),
            ),
          );
        }),
      ),
    ],
  );
  }

  Widget _cover(Book book) {
    if (book.coverImageUrl.isEmpty) {
      return const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF5B2118), Color(0xFF151515)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
      );
    }
    return Image.network(
      book.coverImageUrl,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => DecoratedBox(
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest),
        child: Icon(Icons.menu_book_rounded, size: 72, color: AppColors.muted),
      ),
    );
  }
}

class SearchTab extends ConsumerWidget {
  const SearchTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(booksControllerProvider);
    final query = ref.watch(searchQueryProvider);
    final language = ref.watch(searchLanguageProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Search'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Discover',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  initialValue: query,
                  onChanged: (value) {
                    ref.read(searchQueryProvider.notifier).state = value;
                    s.loadBooks(query: value, language: language);
                  },
                  onFieldSubmitted: (v) =>
                      s.loadBooks(query: v, language: language),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search),
                    hintText: 'Search books',
                  ),
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                ),
                const SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: ['all', 'english', 'malayalam', 'hindi']
                        .map(
                          (x) => Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(x),
                              selected: language == x,
                              onSelected: (_) {
                                ref
                                        .read(searchLanguageProvider.notifier)
                                        .state =
                                    x;
                                s.loadBooks(query: query, language: x);
                              },
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: s.loading
                ? const GridLoadingSkeleton()
                : s.error != null
                    ? _InlineState(
                        icon: Icons.cloud_off_rounded,
                        title: 'Search is unavailable',
                        message: s.error!,
                        action: TextButton.icon(
                          onPressed: () => s.loadBooks(query: query, language: language),
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Try again'),
                        ),
                      )
                    : s.books.isEmpty
                        ? const _InlineState(
                            icon: Icons.search_off_rounded,
                            title: 'No stories found',
                            message: 'Try another title or language filter.',
                          )
                        : GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate:
                        SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 14,
                          mainAxisSpacing: 16,
                          mainAxisExtent: BookCard.shelfHeight(context) + 18,
                        ),
                    itemCount: s.books.length,
                    itemBuilder: (_, i) => BookCard(
                      book: s.books[i],
                      onTap: () => openBook(context, s.books[i]),
                    ),
                  ),
          ),
        ],
      ),
    ));
  }
}

class CollectionTab extends ConsumerWidget {
  const CollectionTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(booksControllerProvider);
    if (!state.collectionLoaded && !state.collectionLoading) {
      Future.microtask(() => ref.read(booksControllerProvider).loadCollection());
    }
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('My Library', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
            const SizedBox(height: 16),
            if (state.collectionLoading)
              const Expanded(child: Center(child: CircularProgressIndicator()))
            else if (state.library.isEmpty)
              const Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.bookmark_border, size: 58, color: AppColors.muted),
                      SizedBox(height: 14),
                      Text('Your saved books will appear here.', style: TextStyle(color: AppColors.muted)),
                    ],
                  ),
                ),
              )
            else
              Expanded(
                child: GridView.builder(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 18,
                    // Leave room for text metrics and larger system font
                    // settings so cards never overflow at the bottom.
                    mainAxisExtent: BookCard.shelfHeight(context) + 14,
                  ),
                  itemCount: state.library.length,
                  itemBuilder: (_, index) {
                    final book = state.library[index];
                    return BookCard(book: book, onTap: () => openBook(context, book));
                  },
                ),
              ),
          ],
        ),
        ),
      );
    
  }
}

class ProfileTab extends ConsumerWidget {
  const ProfileTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(sessionControllerProvider);
    final theme = ref.watch(themeControllerProvider);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Profile',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 24),
          CircleAvatar(
            radius: 38,
            backgroundColor: AppColors.coral,
            child: Text(
              (s.user?.name.isNotEmpty ?? false)
                  ? s.user!.name[0].toUpperCase()
                  : 'U',
              style: const TextStyle(
                fontSize: 30,
                fontWeight: FontWeight.w900,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            s.user?.name ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          Text(
            s.user?.phoneNumber ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 28),
          ListTile(
            leading: Icon(theme.mode == ThemeMode.dark ? Icons.dark_mode : Icons.light_mode),
            title: const Text('Appearance'),
            subtitle: Text(theme.mode == ThemeMode.dark ? 'Dark mode' : 'Light mode'),
            trailing: Switch(
              value: theme.mode == ThemeMode.dark,
              onChanged: (_) => ref.read(themeControllerProvider).toggle(),
            ),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.auto_stories_outlined),
            title: const Text('Purchased stories'),
            subtitle: Text('${s.user?.purchasedBookIds.length ?? 0} stories unlocked'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              ref.read(booksControllerProvider).loadCollection(forceRefresh: true);
              ref.read(mainTabIndexProvider.notifier).state = 1;
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.language),
            title: const Text('Language preference'),
            subtitle: Text(s.user?.languagePreference ?? 'all'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => showLanguagePicker(context, s, ref),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.description_outlined),
            title: const Text('Legal'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const LegalScreen()),
            ),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () async {
              await ref.read(playerControllerProvider).stop();
              await s.logout();
            },
            icon: const Icon(Icons.logout),
            label: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}

Future<void> showLanguagePicker(
  BuildContext context,
  SessionController state,
  WidgetRef ref,
) async {
  final selected = await showModalBottomSheet<String>(
    context: context,
    backgroundColor: Theme.of(context).colorScheme.surface,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const ListTile(
            title: Text(
              'Choose listening language',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          for (final language in ['all', 'english', 'malayalam', 'hindi'])
            ListTile(
              title: Text(language[0].toUpperCase() + language.substring(1)),
              trailing: state.user?.languagePreference == language
                  ? const Icon(Icons.check_circle, color: AppColors.coral)
                  : null,
              onTap: () => Navigator.pop(sheetContext, language),
            ),
        ],
      ),
    ),
  );
  if (selected == null || !context.mounted) return;
  try {
    await state.updateLanguage(selected);
    if (context.mounted) {
      AppMessage.show(context, 'Language preference updated');
    }
  } catch (error) {
    if (context.mounted) {
      AppMessage.show(
        context,
        ref.read(apiClientProvider).errorMessage(error),
        success: false,
      );
    }
  }
}

class MiniPlayer extends ConsumerWidget {
  const MiniPlayer({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(playerControllerProvider);
    final b = s.currentBook;
    if (b == null) return const SizedBox.shrink();
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: SafeArea(
        top: false,
        child: ListTile(
          dense: true,
          visualDensity: const VisualDensity(horizontal: 0, vertical: -2),
          minVerticalPadding: 2,
          contentPadding: const EdgeInsets.fromLTRB(16, 2, 8, 2),
        onTap: () {
          // Open the full player when the mini-player itself is tapped.
          // The play/pause button remains an independent control.
          final episode = s.currentEpisode ??
              (b.episodes.isNotEmpty ? b.episodes.first : null);
          if (episode != null) {
            Navigator.of(context).push(
              _slideUpRoute(
                EpisodePlayerScreen(book: b, episode: episode),
              ),
            );
          } else {
            Navigator.of(context).push(
              _slideUpRoute(BookDetail(book: b)),
            );
          }
        },
        leading: b.coverImageUrl.isEmpty
            ? const Icon(Icons.audio_file)
            : ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  b.coverImageUrl,
                  width: 44,
                  height: 44,
                  fit: BoxFit.cover,
                ),
              ),
        title: Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        trailing: StreamBuilder<bool>(
          stream: s.audioPlayer.playingStream,
          builder: (_, snap) => IconButton(
            onPressed: s.togglePlayback,
            icon: Icon(
              snap.data == true
                  ? Icons.pause_circle_filled
                  : Icons.play_circle_fill,
              color: AppColors.coral,
              size: 36,
            ),
          ),
        ),
        ),
      ),
    );
  }
}

class _InlineState extends StatelessWidget {
  const _InlineState({required this.icon, required this.title, required this.message, this.action});

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 44, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 14),
          Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.muted)),
          if (action != null) ...[const SizedBox(height: 12), action!],
        ],
      ),
    ),
  );
}

Route<void> _slideUpRoute(Widget page) => PageRouteBuilder<void>(
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

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
  );
}

class _DemoNotificationsSheet extends StatelessWidget {
  const _DemoNotificationsSheet();

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Container(
      constraints: const BoxConstraints(maxHeight: 520),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.muted,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'Notifications',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView(
              children: const [
                _DemoNotificationTile(
                  icon: Icons.auto_awesome,
                  title: 'New story available',
                  message: 'A fresh Malayalam story is ready to listen.',
                  time: 'Just now',
                ),
                _DemoNotificationTile(
                  icon: Icons.headphones,
                  title: 'Continue listening',
                  message: 'Your saved episode is waiting for you.',
                  time: 'Today',
                ),
                _DemoNotificationTile(
                  icon: Icons.card_membership,
                  title: 'Explore HappiNotes Premium',
                  message: 'Unlock more stories and listen without limits.',
                  time: 'Yesterday',
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _DemoNotificationTile extends StatelessWidget {
  const _DemoNotificationTile({
    required this.icon,
    required this.title,
    required this.message,
    required this.time,
  });

  final IconData icon;
  final String title;
  final String message;
  final String time;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(vertical: 6),
    leading: CircleAvatar(
      backgroundColor: AppColors.coral.withValues(alpha: .16),
      child: Icon(icon, color: AppColors.coral),
    ),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
    subtitle: Text('$message\n$time'),
    isThreeLine: true,
  );
}

void openBook(BuildContext context, Book b) => Navigator.of(
  context,
).push(MaterialPageRoute(builder: (_) => BookDetail(book: b)));
