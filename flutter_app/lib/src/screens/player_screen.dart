import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../theme.dart';

class PlayerScreen extends ConsumerWidget {
  const PlayerScreen({super.key});

  String _time(Duration value) {
    final minutes = value.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final player = ref.watch(playerControllerProvider);
    final book = player.currentBook;
    final episode = player.currentEpisode;
    if (book == null || episode == null) {
      return const Scaffold(body: Center(child: Text('Nothing is playing')));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Now playing')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            const Spacer(),
            ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: book.coverImageUrl.isEmpty
                  ? const ColoredBox(color: AppColors.raised, child: SizedBox.square(dimension: 280))
                  : Image.network(book.coverImageUrl, width: 280, height: 280, fit: BoxFit.cover),
            ),
            const SizedBox(height: 28),
            Text(episode.title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(book.title, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 24),
            StreamBuilder<Duration>(
              stream: player.audioPlayer.positionStream,
              initialData: player.audioPlayer.position,
              builder: (context, positionSnapshot) {
                final position = positionSnapshot.data ?? Duration.zero;
                final duration = player.audioPlayer.duration ?? Duration.zero;
                final max = duration.inMilliseconds <= 0 ? 1.0 : duration.inMilliseconds.toDouble();
                return Column(children: [
                  Slider(
                    value: position.inMilliseconds.clamp(0, max.toInt()).toDouble(),
                    max: max,
                    activeColor: AppColors.coral,
                    onChanged: duration == Duration.zero ? null : (value) => player.audioPlayer.seek(Duration(milliseconds: value.round())),
                  ),
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(_time(position)), Text(_time(duration))]),
                ]);
              },
            ),
            const SizedBox(height: 20),
            StreamBuilder<bool>(
              stream: player.audioPlayer.playingStream,
              initialData: player.audioPlayer.playing,
              builder: (_, snapshot) => IconButton.filled(
                onPressed: player.togglePlayback,
                style: IconButton.styleFrom(backgroundColor: AppColors.coral, minimumSize: const Size(76, 76)),
                iconSize: 44,
                icon: Icon(snapshot.data == true ? Icons.pause_rounded : Icons.play_arrow_rounded),
              ),
            ),
            const Spacer(),
          ]),
        ),
      ),
    );
  }
}
