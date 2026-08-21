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
import 'legal_screen.dart';
import 'membership_screen.dart';
import 'player_screen.dart';

class MainShell extends ConsumerWidget {
  const MainShell({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
      const SearchTab(),
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
            onDestinationSelected: (value) =>
                ref.read(mainTabIndexProvider.notifier).state = value,
            backgroundColor: AppColors.surface,
            indicatorColor: AppColors.coral.withValues(alpha: .2),
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Home',
              ),
              NavigationDestination(icon: Icon(Icons.search), label: 'Search'),
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
      final books = s.books;
      final player = ref.watch(playerControllerProvider);
      final width = MediaQuery.sizeOf(context).width;
      return SafeArea(
        child: RefreshIndicator(
          onRefresh: s.loadBooks,
          child: ListView(
            padding: const EdgeInsets.only(top: 12, bottom: 28),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => ref.read(mainTabIndexProvider.notifier).state = 1,
                        borderRadius: BorderRadius.circular(30),
                        child: Container(
                          height: 52,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF161616),
                            border: Border.all(color: const Color(0xFF383838)),
                            borderRadius: BorderRadius.circular(28),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.search_rounded, color: AppColors.muted, size: 27),
                              SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'Search your next story',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(color: AppColors.muted, fontSize: 16),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      height: 52,
                      width: 52,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF383838)),
                      ),
                      child: IconButton(
                        tooltip: 'Voice search',
                        onPressed: () => AppMessage.show(context, 'Voice search coming soon'),
                        icon: const Icon(Icons.mic_none_rounded),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 18),
                child: Row(
                  children: [
                    _HomeTabLabel('Popular', active: true),
                    SizedBox(width: 30),
                    _HomeTabLabel('Audiobooks'),
                    SizedBox(width: 30),
                    _HomeTabLabel('New & Hot'),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (s.loading)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 18),
                  child: HomeLoadingSkeleton(),
                )
              else if (s.error != null)
                Padding(
                  padding: const EdgeInsets.all(28),
                  child: Text(s.error!, style: const TextStyle(color: Colors.redAccent)),
                )
              else if (books.isEmpty && s.upcoming.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(40),
                  child: Text(
                    'New audio stories will appear here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted),
                  ),
                )
              else ...[
                _FeaturedRail(books: books, width: width),
                const SizedBox(height: 10),
                if (player.currentBook != null)
                  _ContinueListening(book: player.currentBook!, player: player)
                else if (books.isNotEmpty)
                  _ContinueListening(book: books.first, player: player, fresh: true),
                const SizedBox(height: 28),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 18),
                  child: SectionTitle('Recently added'),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: BookCard.shelfHeight(context),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    scrollDirection: Axis.horizontal,
                    itemCount: books.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (_, i) => BookCard(book: books[i], onTap: () => openBook(context, books[i])),
                  ),
                ),
                const SizedBox(height: 28),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 18),
                  child: SectionTitle('Free to listen'),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: BookCard.shelfHeight(context),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    scrollDirection: Axis.horizontal,
                    itemCount: books.where((b) => b.accessType == 'free').length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (_, i) {
                      final free = books.where((b) => b.accessType == 'free').toList()[i];
                      return BookCard(book: free, onTap: () => openBook(context, free));
                    },
                  ),
                ),
              ],
              if (!s.loading && s.upcoming.isNotEmpty) ...[
                const SizedBox(height: 28),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 18),
                  child: SectionTitle('Coming soon'),
                ),
                const SizedBox(height: 6),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 18),
                  child: Text(
                  'New audiobooks being prepared for release.',
                  style: TextStyle(color: AppColors.muted),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: BookCard.shelfHeight(context),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    scrollDirection: Axis.horizontal,
                    itemCount: s.upcoming.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (_, index) {
                      final book = s.upcoming[index];
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

class _HomeTabLabel extends StatelessWidget {
  const _HomeTabLabel(this.label, {this.active = false});
  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: TextStyle(fontSize: 17, fontWeight: active ? FontWeight.w800 : FontWeight.w600, color: active ? AppColors.text : AppColors.muted)),
      const SizedBox(height: 10),
      AnimatedContainer(duration: const Duration(milliseconds: 180), width: active ? 64 : 0, height: 3, color: AppColors.coral),
    ],
  );
}

class _FeaturedRail extends StatelessWidget {
  const _FeaturedRail({required this.books, required this.width});
  final List<Book> books;
  final double width;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      SizedBox(
        height: 382,
        child: ListView.separated(
          padding: const EdgeInsets.only(left: 18, right: 8),
          scrollDirection: Axis.horizontal,
          itemCount: books.length.clamp(1, 8).toInt(),
          separatorBuilder: (_, _) => const SizedBox(width: 14),
          itemBuilder: (_, index) {
            final book = books[index];
            return SizedBox(
              width: (width * .78).clamp(270.0, 330.0),
              child: InkWell(
                onTap: () => openBook(context, book),
                borderRadius: BorderRadius.circular(22),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(22),
                      child: book.coverImageUrl.isEmpty
                          ? const ColoredBox(color: AppColors.raised)
                          : Image.network(book.coverImageUrl, fit: BoxFit.cover, errorBuilder: (_, _, _) => const ColoredBox(color: AppColors.raised)),
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(22),
                        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0xE6000000)]),
                      ),
                    ),
                    Positioned(
                      top: 14,
                      right: 14,
                      child: DecoratedBox(
                        decoration: BoxDecoration(color: Colors.black.withValues(alpha: .48), shape: BoxShape.circle),
                        child: const Padding(padding: EdgeInsets.all(9), child: Icon(Icons.bookmark_border_rounded, color: Colors.white, size: 22)),
                      ),
                    ),
                    Positioned(
                      left: 18,
                      right: 18,
                      bottom: 20,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('FEATURED AUDIOBOOK', style: TextStyle(color: AppColors.saffron, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.1)),
                        const SizedBox(height: 8),
                        Text(book.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 25, height: 1.05, fontWeight: FontWeight.w900, color: Colors.white)),
                        const SizedBox(height: 6),
                        Text(book.language.toUpperCase(), style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700)),
                      ]),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
      const SizedBox(height: 12),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(width: 38, height: 8, decoration: BoxDecoration(color: AppColors.text, borderRadius: BorderRadius.circular(8))),
        ...List.generate(books.length.clamp(2, 5).toInt() - 1, (_) => const Padding(padding: EdgeInsets.only(left: 7), child: CircleAvatar(radius: 4, backgroundColor: Color(0xFF565656)))),
      ]),
    ],
  );
}

class _ContinueListening extends ConsumerWidget {
  const _ContinueListening({required this.book, required this.player, this.fresh = false});
  final Book book;
  final dynamic player;
  final bool fresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final episode = player.currentEpisode ?? (book.episodes.isEmpty ? null : book.episodes.first);
    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.fromLTRB(18, 18, 12, 12),
      decoration: const BoxDecoration(
        color: Color(0xFF710706),
        borderRadius: BorderRadius.only(topRight: Radius.circular(30), bottomRight: Radius.circular(30)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Continue Listening', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
        const SizedBox(height: 15),
        Row(children: [
          ClipRRect(borderRadius: BorderRadius.circular(8), child: book.coverImageUrl.isEmpty ? const SizedBox(width: 70, height: 82, child: ColoredBox(color: AppColors.raised)) : Image.network(book.coverImageUrl, width: 70, height: 82, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox(width: 70, height: 82, child: ColoredBox(color: AppColors.raised)))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(book.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(fresh ? 'Start listening now' : (episode?.title ?? 'Continue your story'), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 10),
            ClipRRect(borderRadius: BorderRadius.circular(4), child: const LinearProgressIndicator(value: .28, minHeight: 4, backgroundColor: Color(0x66FFFFFF), color: AppColors.coral)),
          ])),
          const SizedBox(width: 6),
          IconButton.filled(onPressed: () async {
            if (episode == null) { openBook(context, book); return; }
            await ref.read(playerControllerProvider).playEpisode(book, episode);
            if (context.mounted) Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlayerScreen()));
          }, style: IconButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Colors.black), icon: const Icon(Icons.play_arrow_rounded)),
        ]),
      ]),
    );
  }
}

class FeaturedBook extends StatelessWidget {
  const FeaturedBook({super.key, required this.book});
  final Book book;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => openBook(context, book),
    child: Container(
      height: 210,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          colors: [Color(0xFF5B2118), Color(0xFF201513)],
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'FEATURED',
                  style: TextStyle(
                    color: AppColors.saffron,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  book.title,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 25,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 16),
                const CircleAvatar(
                  backgroundColor: AppColors.coral,
                  child: Icon(Icons.play_arrow, color: Colors.white),
                ),
              ],
            ),
          ),
          if (book.coverImageUrl.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                book.coverImageUrl,
                width: 112,
                height: 160,
                fit: BoxFit.cover,
              ),
            ),
        ],
      ),
    ),
  );
}

class SearchTab extends ConsumerWidget {
  const SearchTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(booksControllerProvider);
    final query = ref.watch(searchQueryProvider);
    final language = ref.watch(searchLanguageProvider);
    return SafeArea(
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
                  key: ValueKey('search-$query'),
                  initialValue: query,
                  onChanged: (value) =>
                      ref.read(searchQueryProvider.notifier).state = value,
                  onFieldSubmitted: (v) =>
                      s.loadBooks(query: v, language: language),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search),
                    hintText: 'Search books',
                    suffixIcon: IconButton(
                      onPressed: () {
                        ref.read(searchQueryProvider.notifier).state = '';
                        s.loadBooks(language: language);
                      },
                      icon: const Icon(Icons.close),
                    ),
                  ),
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
                : GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: .58,
                          crossAxisSpacing: 14,
                          mainAxisSpacing: 16,
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
    );
  }
}

class CollectionTab extends StatelessWidget {
  const CollectionTab({super.key});
  @override
  Widget build(BuildContext context) => const SafeArea(
    child: Padding(
      padding: EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'My Library',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
          ),
          Spacer(),
          Center(
            child: Column(
              children: [
                Icon(Icons.bookmark_border, size: 58, color: AppColors.muted),
                SizedBox(height: 14),
                Text(
                  'Your saved books will appear here.',
                  style: TextStyle(color: AppColors.muted),
                ),
              ],
            ),
          ),
          Spacer(),
        ],
      ),
    ),
  );
}

class ProfileTab extends ConsumerWidget {
  const ProfileTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(sessionControllerProvider);
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
            leading: const Icon(Icons.workspace_premium_outlined),
            title: const Text('Membership'),
            subtitle: Text(
              s.user?.subscriptionStatus == 'free'
                  ? 'View premium plans'
                  : '${s.user?.subscriptionStatus.toUpperCase()} member',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const MembershipScreen()),
            ),
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
    backgroundColor: AppColors.surface,
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
      color: AppColors.raised,
      child: ListTile(
        leading: b.coverImageUrl.isEmpty
            ? const Icon(Icons.audio_file)
            : Image.network(
                b.coverImageUrl,
                width: 42,
                height: 52,
                fit: BoxFit.cover,
              ),
        title: Text(s.currentEpisode?.title ?? b.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlayerScreen())),
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
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
  );
}

void openBook(BuildContext context, Book b) => Navigator.of(
  context,
).push(MaterialPageRoute(builder: (_) => BookDetail(book: b)));
