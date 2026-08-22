import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import '../../app/providers.dart';
import '../../features/books/domain/entities/book.dart';
import '../theme.dart';
import '../widgets/app_message.dart';

class EpisodePlayerScreen extends ConsumerWidget {
  const EpisodePlayerScreen({super.key, required this.book, required this.episode});
  final Book book;
  final BookEpisode episode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final player = ref.watch(playerControllerProvider);
    final current = player.currentEpisode ?? episode;
    final index = book.episodes.indexOf(current);
    final books = ref.watch(booksControllerProvider);
    final saved = books.library.any((item) => item.id == book.id);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Audio Only'),
        leading: IconButton(icon: const Icon(Icons.keyboard_arrow_down), onPressed: () => Navigator.pop(context)),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: book.coverImageUrl.isEmpty
                      ? const ColoredBox(color: AppColors.raised, child: Icon(Icons.headphones, size: 80))
                      : CachedNetworkImage(imageUrl: book.coverImageUrl, fit: BoxFit.cover, width: double.infinity),
                ),
              ),
              const SizedBox(height: 18),
              Align(alignment: Alignment.centerLeft, child: Text('${book.accessType.toUpperCase()}  •  Episode ${index + 1} / ${book.episodes.length}', style: const TextStyle(color: AppColors.muted))),
              const SizedBox(height: 6),
              Align(alignment: Alignment.centerLeft, child: Text(current.title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800))),
              if (current.description.isNotEmpty) Align(alignment: Alignment.centerLeft, child: Text(current.description, maxLines: 2, overflow: TextOverflow.ellipsis)),
              const SizedBox(height: 12),
              StreamBuilder<Duration>(
                stream: player.audioPlayer.positionStream,
                builder: (_, position) => StreamBuilder<Duration?>(
                  stream: player.audioPlayer.durationStream,
                  builder: (_, duration) {
                    final total = duration.data ?? Duration.zero;
                    final value = total.inMilliseconds == 0 ? 0.0 : (position.data ?? Duration.zero).inMilliseconds / total.inMilliseconds;
                    return Column(children: [
                      Slider(value: value.clamp(0.0, 1.0).toDouble(), onChanged: total == Duration.zero ? null : (v) => player.audioPlayer.seek(total * v)),
                      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(_time(position.data ?? Duration.zero)), Text('-${_time(total - (position.data ?? Duration.zero))}')]),
                    ]);
                  },
                ),
              ),
              StreamBuilder<bool>(
                stream: player.audioPlayer.playingStream,
                initialData: player.audioPlayer.playing,
                builder: (_, playing) => Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
                  IconButton(iconSize: 34, onPressed: player.playPrevious, icon: const Icon(Icons.skip_previous_rounded)),
                  IconButton(iconSize: 64, onPressed: player.togglePlayback, icon: Icon(playing.data == true ? Icons.pause_circle_filled : Icons.play_circle_filled, color: AppColors.coral)),
                  IconButton(iconSize: 34, onPressed: player.playNext, icon: const Icon(Icons.skip_next_rounded)),
                ]),
              ),
              Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                const _Action(icon: Icons.timer_outlined, label: 'Timer'),
                _Action(
                  icon: saved ? Icons.bookmark : Icons.bookmark_border,
                  label: saved ? 'Saved' : 'Save',
                  onTap: () async {
                    final controller = ref.read(booksControllerProvider);
                    final error = saved
                        ? await controller.removeFromCollection(book)
                        : await controller.addToCollection(book);
                    if (context.mounted) AppMessage.show(context, error ?? (saved ? 'Removed from library' : 'Saved to library'), success: error == null);
                  },
                ),
                _Action(
                  icon: Icons.share_outlined,
                  label: 'Share',
                  onTap: () => Share.share('${book.title}\n\nListen on HappiNotes'),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  static String _time(Duration value) => '${value.inMinutes.remainder(60).toString().padLeft(2, '0')}:${value.inSeconds.remainder(60).toString().padLeft(2, '0')}';
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, this.onTap});
  final IconData icon; final String label;
  final VoidCallback? onTap;
  @override Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(12), child: Padding(padding: const EdgeInsets.all(8), child: Column(children: [Icon(icon), const SizedBox(height: 4), Text(label)])));
}
