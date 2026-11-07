import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/books/domain/entities/book.dart';
import 'subscription_screen.dart';

/// Backwards-compatible route wrapper. Premium access is subscription-only;
/// keep the old route name without presenting a one-time purchase flow.
class BookPurchaseScreen extends ConsumerWidget {
  const BookPurchaseScreen({super.key, required this.book});
  final Book book;

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      const SubscriptionScreen(showCloseButton: true);
}
