import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/books/domain/entities/book.dart';
import '../theme.dart';
import '../widgets/app_message.dart';

class BookDetail extends ConsumerWidget {
  const BookDetail({super.key, required this.book});
  final Book book;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
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
                    color: Colors.black.withValues(alpha: .38),
                    colorBlendMode: BlendMode.darken,
                  ),
                Center(
                  child: Hero(
                    tag: 'book-${book.id}',
                    child: Container(
                      width: 175,
                      height: 245,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: const [
                          BoxShadow(color: Colors.black54, blurRadius: 24),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: book.coverImageUrl.isEmpty
                          ? const ColoredBox(color: AppColors.raised)
                          : CachedNetworkImage(
                              imageUrl: book.coverImageUrl,
                              fit: BoxFit.cover,
                            ),
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
              const Text(
                'Audio',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(
                  backgroundColor: AppColors.coral,
                  child: Icon(Icons.play_arrow, color: Colors.white),
                ),
                title: Text(
                  book.audioUrl.isEmpty
                      ? 'Audio coming soon'
                      : 'Main book audio',
                ),
                subtitle: Text('${(book.duration / 60).round()} minutes'),
              ),
            ],
          ),
        ),
      ],
    ),
    bottomNavigationBar: SafeArea(
      minimum: const EdgeInsets.all(16),
      child: FilledButton.icon(
        onPressed: book.audioUrl.isEmpty
            ? null
            : () async {
                try {
                  await ref.read(playerControllerProvider).play(book);
                } catch (e) {
                  if (context.mounted) {
                    AppMessage.show(context, e.toString(), success: false);
                  }
                }
              },
        icon: const Icon(Icons.play_arrow_rounded),
        label: const Text('Start listening'),
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.coral,
          padding: const EdgeInsets.all(17),
        ),
      ),
    ),
  );
}
