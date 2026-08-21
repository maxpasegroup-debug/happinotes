import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/admin/presentation/controllers/admin_controller.dart';
import '../theme.dart';
import '../widgets/app_message.dart';
import '../widgets/loading_skeleton.dart';

class AdminScreen extends ConsumerWidget {
  const AdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(adminControllerProvider);
    final pages = [
      const _Dashboard(),
      const _Books(),
      const _Users(),
      const _Notifications(),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('HappiNotes Admin', style: TextStyle(fontWeight: FontWeight.w900)),
            Text('Editorial control', style: TextStyle(fontSize: 12)),
          ],
        ),
        actions: [
          IconButton(onPressed: state.loading ? null : state.loadAll, icon: const Icon(Icons.refresh)),
          IconButton(
            tooltip: 'Logout',
            onPressed: () => ref.read(sessionControllerProvider).logout(),
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: state.loading
          ? const DashboardLoadingSkeleton()
          : state.error != null && state.books.isEmpty
          ? _ErrorState(message: state.error!, retry: state.loadAll)
          : IndexedStack(index: state.tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: state.tab,
        onDestinationSelected: state.selectTab,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.library_books_outlined), selectedIcon: Icon(Icons.library_books), label: 'Books'),
          NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'Users'),
          NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'Notify'),
        ],
      ),
      floatingActionButton: state.tab == 1
          ? FloatingActionButton.extended(
              onPressed: () {
                state.newBook();
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminBookEditor()));
              },
              icon: const Icon(Icons.add),
              label: const Text('Add book'),
            )
          : null,
    );
  }
}

class _Dashboard extends ConsumerWidget {
  const _Dashboard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(adminControllerProvider);
    final values = [
      ('Users', s.stats['totalUsers'] ?? 0, Icons.people_rounded),
      ('Premium', s.stats['activePremiumSubscribers'] ?? 0, Icons.workspace_premium_rounded),
      ('Live books', s.stats['totalBooksPublished'] ?? 0, Icons.menu_book_rounded),
      ('Chapters', s.stats['totalChaptersUploaded'] ?? 0, Icons.queue_music_rounded),
    ];
    return RefreshIndicator(
      onRefresh: s.loadAll,
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Text('Dashboard', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          const Text('Everything happening across HappiNotes.'),
          const SizedBox(height: 20),
          LayoutBuilder(
            builder: (context, constraints) {
              const gap = 12.0;
              final columns = constraints.maxWidth < 330 ? 1 : 2;
              final cardWidth =
                  (constraints.maxWidth - gap * (columns - 1)) / columns;
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: values
                    .map(
                      (item) => SizedBox(
                        width: cardWidth,
                        child: _MetricCard(
                          label: item.$1,
                          value: '${item.$2}',
                          icon: item.$3,
                        ),
                      ),
                    )
                    .toList(),
              );
            },
          ),
          const SizedBox(height: 16),
          Card(child: ListTile(
            leading: const Icon(Icons.trending_up_rounded),
            title: const Text('Most listened'),
            subtitle: Text((s.stats['mostListenedBook'] ?? 'Not available').toString()),
          )),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 18),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                maxLines: 1,
                style: const TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            const SizedBox(height: 3),
            Text(label, maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

class _Books extends ConsumerWidget {
  const _Books();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(adminControllerProvider);
    if (s.books.isEmpty) return const Center(child: Text('No books yet. Tap Add book to create one.'));
    return RefreshIndicator(
      onRefresh: s.loadAll,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        itemCount: s.books.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final book = s.books[index];
          final cover = (book['coverImageUrl'] ?? '').toString();
          return Card(
            child: ListTile(
              contentPadding: const EdgeInsets.all(10),
              leading: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: cover.isEmpty
                    ? Container(width: 54, height: 72, color: Colors.black12, child: const Icon(Icons.book))
                    : Image.network(cover, width: 54, height: 72, fit: BoxFit.cover),
              ),
              title: Text((book['title'] ?? 'Untitled').toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text(
                '${book['language']}  •  ${book['status']}  •  '
                '${book['accessType'] ?? book['type'] ?? 'free'}  •  '
                '${((book['lessons'] as List?) ?? const []).length} episodes',
              ),
              trailing: PopupMenuButton<String>(
                onSelected: (action) async {
                  if (action == 'edit') {
                    s.editBook(book);
                    if (context.mounted) Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminBookEditor()));
                  } else if (await _confirmDelete(context, (book['title'] ?? '').toString())) {
                    final ok = await s.removeBook(book['_id'].toString());
                    if (context.mounted) AdminSnack.show(context, ok ? 'Book deleted' : s.error ?? 'Delete failed', success: ok);
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Edit')),
                  PopupMenuItem(value: 'delete', child: Text('Delete')),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<bool> _confirmDelete(BuildContext context, String title) async =>
      await showDialog<bool>(context: context, builder: (context) => AlertDialog(
        title: const Text('Delete book?'),
        content: Text('$title and its chapters will be permanently deleted.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      )) ?? false;
}

class _Users extends ConsumerWidget {
  const _Users();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(adminControllerProvider);
    final users = state.users;
    return ListView.separated(
      padding: const EdgeInsets.all(16), itemCount: users.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (_, i) {
        final u = users[i];
        final contact = (u['phoneNumber'] ?? u['email'] ?? 'No contact').toString();
        return ListTile(
          leading: CircleAvatar(child: Text((u['name'] ?? contact).toString().characters.first.toUpperCase())),
          title: Text((u['name'] ?? 'HappiNotes listener').toString()),
          subtitle: Text(contact),
          trailing: u['role'] == 'admin'
              ? const Chip(label: Text('admin'))
              : PopupMenuButton<String>(
                  tooltip: 'Manage user',
                  onSelected: (action) async {
                    bool ok;
                    if (action == 'delete') {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (dialogContext) => AlertDialog(
                          title: const Text('Delete this user?'),
                          content: Text('The account for $contact will be permanently removed.'),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
                            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Delete')),
                          ],
                        ),
                      ) ?? false;
                      if (!confirmed) return;
                      ok = await state.removeUser(u['_id'].toString());
                    } else {
                      ok = await state.changeSubscription(u['_id'].toString(), action);
                    }
                    if (context.mounted) AdminSnack.show(context, ok ? state.success ?? 'Updated' : state.error ?? 'Update failed', success: ok);
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'free', child: Text('Set Free')),
                    PopupMenuItem(value: 'premium', child: Text('Set Premium')),
                    PopupMenuItem(value: 'lifetime', child: Text('Set Lifetime')),
                    PopupMenuDivider(),
                    PopupMenuItem(value: 'delete', child: Text('Delete user')),
                  ],
                  child: Chip(label: Text((u['subscriptionStatus'] ?? 'free').toString())),
                ),
        );
      },
    );
  }
}

class _Notifications extends ConsumerWidget {
  const _Notifications();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(adminControllerProvider);
    final target = ref.watch(adminNotificationTargetProvider);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Send notification', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 8), const Text('Broadcast an update to listener devices.'), const SizedBox(height: 22),
        TextFormField(onChanged: (v) => ref.read(adminNotificationTitleProvider.notifier).state = v, decoration: const InputDecoration(labelText: 'Title')),
        const SizedBox(height: 14),
        TextFormField(onChanged: (v) => ref.read(adminNotificationMessageProvider.notifier).state = v, minLines: 4, maxLines: 6, decoration: const InputDecoration(labelText: 'Message')),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(
          initialValue: target,
          decoration: const InputDecoration(labelText: 'Audience'),
          items: const ['all', 'free', 'premium'].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
          onChanged: (v) => ref.read(adminNotificationTargetProvider.notifier).state = v ?? 'all',
        ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: state.busy ? null : () async {
            final ok = await state.notifyUsers(ref.read(adminNotificationTitleProvider), ref.read(adminNotificationMessageProvider), target);
            if (context.mounted) AdminSnack.show(context, ok ? 'Notification sent' : state.error ?? 'Could not send', success: ok);
          },
          icon: const Icon(Icons.send_rounded), label: Text(state.busy ? 'Sending...' : 'Send notification'),
        ),
      ],
    );
  }
}

class AdminBookEditor extends ConsumerWidget {
  const AdminBookEditor({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(adminControllerProvider);
    final d = state.draft;
    Widget input(String label, String value, ValueChanged<String> changed, {int lines = 1, TextInputType? type}) =>
        Padding(padding: const EdgeInsets.only(bottom: 14), child: TextFormField(
          initialValue: value, onChanged: changed, minLines: lines, maxLines: lines == 1 ? 1 : 5, keyboardType: type,
          decoration: InputDecoration(labelText: label),
        ));
    Widget select(String label, String value, List<String> options, ValueChanged<String> changed) =>
        Padding(padding: const EdgeInsets.only(bottom: 14), child: DropdownButtonFormField<String>(
          initialValue: value, decoration: InputDecoration(labelText: label),
          items: options.map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
          onChanged: (v) { if (v != null) { changed(v); state.notifyChanged(); } },
        ));
    return Scaffold(
      appBar: AppBar(title: Text(d.id == null ? 'Add new book' : 'Edit book')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          input('Title *', d.title, (v) => d.title = v),
          input('Description *', d.description, (v) => d.description = v, lines: 4),
          select('Language', d.language, const ['english', 'malayalam', 'hindi'], (v) => d.language = v),
          select('Category', d.category, const ['health', 'wealth', 'happiness', 'mindfulness'], (v) => d.category = v),
          select('Status', d.status, const ['draft', 'upcoming', 'live'], (v) => d.status = v),
          select('Access', d.accessType, const ['free', 'premium'], (v) => d.accessType = v),
          const Text('Cover image', style: TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 8),
          if (d.coverImageUrl.isNotEmpty) ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network(d.coverImageUrl, height: 180, fit: BoxFit.contain)),
          OutlinedButton.icon(onPressed: state.busy ? null : () => state.uploadMedia('cover'), icon: const Icon(Icons.image_outlined), label: Text(d.coverImageUrl.isEmpty ? 'Choose image' : 'Replace image')),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Story episodes', style: TextStyle(fontWeight: FontWeight.w800)),
              Text('${d.episodes.length} added', style: const TextStyle(color: AppColors.muted)),
            ],
          ),
          const SizedBox(height: 8),
          ...d.episodes.asMap().entries.map((entry) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(child: Text('${entry.key + 1}')),
                title: Text(entry.value['title']?.toString() ?? 'Episode ${entry.key + 1}'),
                subtitle: Text(entry.value['fileName']?.toString() ?? 'MP3 uploaded'),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: state.busy ? null : () => state.removeEpisode(entry.key),
                ),
              )),
          OutlinedButton.icon(
            onPressed: state.busy ? null : state.uploadEpisode,
            icon: const Icon(Icons.playlist_add_rounded),
            label: const Text('Add episode MP3'),
          ),
          const SizedBox(height: 14),
          input('Duration in seconds', d.duration, (v) => d.duration = v, type: TextInputType.number),
          input('Sort order', d.sortOrder, (v) => d.sortOrder = v, type: TextInputType.number),
          input('Tags separated by commas', d.tags, (v) => d.tags = v),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Featured'), value: d.featured, onChanged: (v) { d.featured = v; state.notifyChanged(); }),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Trending'), value: d.trending, onChanged: (v) { d.trending = v; state.notifyChanged(); }),
          if (state.error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(state.error!, style: const TextStyle(color: Colors.red))),
          FilledButton(
            onPressed: state.busy ? null : () async {
              final ok = await state.saveBook();
              if (context.mounted) {
                AdminSnack.show(context, ok ? state.success ?? 'Saved' : state.error ?? 'Could not save', success: ok);
                if (ok) Navigator.pop(context);
              }
            },
            child: Text(state.busy ? 'Saving...' : d.id == null ? 'Create book' : 'Update book'),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.retry});
  final String message; final VoidCallback retry;
  @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [Text(message, textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton(onPressed: retry, child: const Text('Retry'))])));
}

class AdminSnack {
  static void show(BuildContext context, String message, {required bool success}) {
    AppMessage.show(context, message, success: success);
  }
}
