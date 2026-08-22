import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import '../../../books/domain/entities/book.dart';

class PlayerController extends ChangeNotifier {
  final AudioPlayer audioPlayer = AudioPlayer();
  Book? currentBook;
  BookEpisode? currentEpisode;
  Future<void> play(Book book) async {
    if (book.episodes.isNotEmpty) {
      await playEpisode(book, book.episodes.first);
    } else {
      await playUrl(book, book.audioUrl);
    }
  }

  Future<void> playEpisode(Book book, BookEpisode episode) async {
    currentBook = book;
    currentEpisode = episode;
    notifyListeners();
    await playUrl(book, episode.audioUrl);
  }

  Future<void> playUrl(Book book, String url) async {
    if (url.isEmpty) throw StateError('This book has no audio yet.');
    if (currentBook?.id != book.id) {
      currentBook = book;
      currentEpisode = null;
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
    currentEpisode = null;
    notifyListeners();
  }

  Future<void> playNext() async {
    final book = currentBook;
    final episode = currentEpisode;
    if (book == null || episode == null) return;
    final index = book.episodes.indexOf(episode);
    if (index >= 0 && index + 1 < book.episodes.length) {
      await playEpisode(book, book.episodes[index + 1]);
    }
  }

  Future<void> playPrevious() async {
    final book = currentBook;
    final episode = currentEpisode;
    if (book == null || episode == null) return;
    final index = book.episodes.indexOf(episode);
    if (index > 0) await playEpisode(book, book.episodes[index - 1]);
  }

  @override
  void dispose() {
    audioPlayer.dispose();
    super.dispose();
  }
}
