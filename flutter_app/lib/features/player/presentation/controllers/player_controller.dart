import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import '../../../books/domain/entities/book.dart';

class PlayerController extends ChangeNotifier {
  final AudioPlayer audioPlayer = AudioPlayer();
  Book? currentBook;
  Episode? currentEpisode;
  Future<void> play(Book book) async {
    if (book.episodes.isEmpty) throw StateError('This book has no episodes yet.');
    await playEpisode(book, book.episodes.first);
  }

  Future<void> playEpisode(Book book, Episode episode) async {
    if (episode.audioUrl.isEmpty) throw StateError('This episode has no audio yet.');
    if (currentBook?.id != book.id || currentEpisode?.id != episode.id) {
      currentBook = book;
      currentEpisode = episode;
      await audioPlayer.setUrl(episode.audioUrl);
    }
    unawaited(audioPlayer.play());
    notifyListeners();
  }

  Future<void> togglePlayback() async {
    if (audioPlayer.playing) {
      await audioPlayer.pause();
    } else {
      await audioPlayer.play();
    }
    notifyListeners();
  }

  Future<void> stop() async {
    await audioPlayer.stop();
    currentBook = null;
    currentEpisode = null;
    notifyListeners();
  }

  @override
  void dispose() {
    audioPlayer.dispose();
    super.dispose();
  }
}
