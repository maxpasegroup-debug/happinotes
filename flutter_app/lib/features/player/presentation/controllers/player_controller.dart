import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import '../../../books/domain/entities/book.dart';

class PlayerController extends ChangeNotifier {
  final AudioPlayer audioPlayer = AudioPlayer();
  Book? currentBook;
  Future<void> play(Book book) async {
    await playUrl(book, book.audioUrl);
  }

  Future<void> playEpisode(Book book, BookEpisode episode) async {
    await playUrl(book, episode.audioUrl);
  }

  Future<void> playUrl(Book book, String url) async {
    if (url.isEmpty) throw StateError('This book has no audio yet.');
    if (currentBook?.id != book.id) {
      currentBook = book;
    }
    await audioPlayer.setUrl(url);
    await audioPlayer.play();
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
    notifyListeners();
  }

  @override
  void dispose() {
    audioPlayer.dispose();
    super.dispose();
  }
}
