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
      return SafeArea(
        child: RefreshIndicator(
          onRefresh: s.loadBooks,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: AppColors.coral,
                    child: Icon(Icons.headphones, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'HappiNotes',
                          style: TextStyle(
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
                    onPressed: () {},
                    icon: const Icon(Icons.notifications_none),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppColors.raised,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const TextField(
                  readOnly: true,
                  decoration: InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Search books and stories',
                    fillColor: Colors.transparent,
                  ),
                ),
              ),
              const SizedBox(height: 22),
              if (s.loading)
                const HomeLoadingSkeleton()
              else if (s.error != null)
                Text(s.error!, style: const TextStyle(color: Colors.redAccent))
              else if (books.isEmpty && s.upcoming.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(40),
                  child: Text(
                    'New audio stories will appear here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted),
                  ),
                )
              else if (books.isNotEmpty) ...[
                FeaturedBook(book: books.first),
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
              if (!s.loading && s.upcoming.isNotEmpty) ...[
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
