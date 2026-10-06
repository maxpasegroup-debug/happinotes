import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/books/domain/entities/book.dart';

class BookPurchaseScreen extends ConsumerWidget {
  const BookPurchaseScreen({super.key, required this.book});
  final Book book;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final purchases = ref.watch(storePurchaseControllerProvider);
    final owned =
        ref
            .watch(sessionControllerProvider)
            .user
            ?.purchasedBookIds
            .contains(book.id) ??
        false;
    final product = purchases.productFor(book.id);
    return Scaffold(
      appBar: AppBar(title: const Text('Unlock story')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Icon(Icons.lock_open_rounded, size: 64),
            const SizedBox(height: 20),
            Text(
              book.title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            const Text(
              'Buy once to unlock all episodes for your HappiNotes account. No subscription.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            if (purchases.loading)
              const Center(child: CircularProgressIndicator())
            else if (owned)
              const Text('This story is unlocked.', textAlign: TextAlign.center)
            else if (product != null)
              Text(
                product.price,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              )
            else
              const Text(
                'This story is not available for purchase yet.',
                textAlign: TextAlign.center,
              ),
            if (purchases.message != null)
              Padding(
                padding: const EdgeInsets.only(top: 20),
                child: Text(purchases.message!, textAlign: TextAlign.center),
              ),
            const SizedBox(height: 32),
            if (owned)
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Continue listening'),
              )
            else
              FilledButton(
                onPressed:
                    purchases.busy ||
                        purchases.loading ||
                        product == null ||
                        purchases.pendingFor(book.id)
                    ? null
                    : () => purchases.buy(book.id),
                child: Text(
                  purchases.busy || purchases.pendingFor(book.id)
                      ? 'Waiting for confirmation…'
                      : 'Buy once${product == null ? '' : ' • ${product.price}'}',
                ),
              ),
            TextButton(
              onPressed: purchases.busy || purchases.loading
                  ? null
                  : purchases.restore,
              child: const Text('Restore purchases'),
            ),
            if (product == null && !purchases.loading)
              TextButton(
                onPressed: purchases.busy ? null : purchases.reload,
                child: const Text('Try again'),
              ),
          ],
        ),
      ),
    );
  }
}
