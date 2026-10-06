import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../network/api_client.dart';

class StorePurchaseController extends ChangeNotifier {
  StorePurchaseController(this.api, this.onVerified) {
    if (!supported) return;
    _subscription = _store.purchaseStream.listen(
      (purchases) {
        _enqueue(purchases);
      },
      onError: (Object error) {
        message =
            'Could not receive purchase updates. Please restore purchases.';
        _checkout = false;
        _notify();
      },
    );
  }

  final ApiClient api;
  final Future<void> Function(String userId, List<String> ids) onVerified;
  final InAppPurchase _store = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _subscription;
  Future<void> _queue = Future<void>.value();
  final Map<String, String> _bookProducts = {};
  final Map<String, ProductDetails> _products = {};
  final Map<String, PurchaseDetails> _retryPurchases = {};
  final Set<String> _completedTransactions = {};
  final Set<String> _pendingProducts = {};
  Future<void>? _reloadFuture;
  int _sessionRevision = 0;
  int _verifying = 0;
  bool _checkout = false;
  bool _restoring = false;
  String? _userId;
  String? _accountToken;
  bool _disposed = false;
  bool available = false;
  bool loading = false;
  bool get busy => _checkout || _restoring || _verifying > 0;
  String? message;
  String? verifiedBookId;
  bool get supported =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);
  String get _platform =>
      defaultTargetPlatform == TargetPlatform.android ? 'android' : 'ios';
  ProductDetails? productFor(String bookId) => _products[_bookProducts[bookId]];
  bool pendingFor(String bookId) =>
      _pendingProducts.contains(_bookProducts[bookId]);

  void setUser(String? userId) {
    if (_userId == userId) return;
    _userId = userId;
    _sessionRevision++;
    _reloadFuture = null;
    _accountToken = null;
    _bookProducts.clear();
    _products.clear();
    message = null;
    verifiedBookId = null;
    _checkout = false;
    _restoring = false;
    _pendingProducts.clear();
    _completedTransactions.clear();
    unawaited(reload());
  }

  Future<void> reload() {
    if (_disposed) return Future<void>.value();
    if (_reloadFuture != null) return _reloadFuture!;
    final revision = _sessionRevision;
    final future = _reload(revision);
    _reloadFuture = future;
    return future.whenComplete(() {
      if (revision == _sessionRevision) _reloadFuture = null;
    });
  }

  Future<void> _reload(int revision) async {
    final userId = _userId;
    if (userId == null || !supported) {
      available = false;
      loading = false;
      _notify();
      return;
    }
    loading = true;
    _products.clear();
    message = null;
    _notify();
    try {
      final storeAvailable = await _store.isAvailable();
      if (revision != _sessionRevision || _disposed) return;
      available = storeAvailable;
      if (!available) {
        throw StateError('The app store is unavailable on this device.');
      }
      final response = await api.dio.get('/payments/store/products');
      if (revision != _sessionRevision || _disposed) return;
      _accountToken = response.data['accountToken'] as String;
      _bookProducts.clear();
      for (final item in response.data['products'] as List) {
        final productId = item[_platform];
        if (productId is String && productId.isNotEmpty) {
          _bookProducts[item['bookId'] as String] = productId;
        }
      }
      _products.clear();
      if (_bookProducts.isNotEmpty) {
        final details = await _store.queryProductDetails(
          _bookProducts.values.toSet(),
        );
        if (revision != _sessionRevision || _disposed) return;
        if (details.error != null) throw StateError(details.error!.message);
        for (final product in details.productDetails) {
          _products[product.id] = product;
        }
        if (details.notFoundIDs.isNotEmpty) {
          message = 'Some purchases are not available from the store yet.';
        }
      }
      // Retry deliveries received before login or during a network outage.
      if (_retryPurchases.isNotEmpty) {
        final retries = _retryPurchases.values.toList();
        _enqueue(retries);
      }
    } catch (error) {
      if (revision == _sessionRevision) message = api.errorMessage(error);
    } finally {
      if (revision == _sessionRevision) {
        loading = false;
        _notify();
      }
    }
  }

  Future<void> buy(String bookId) async {
    if (_disposed || busy || loading || pendingFor(bookId)) return;
    final revision = _sessionRevision;
    // Store product details may become stale while a screen is open.
    await reload();
    if (_disposed || revision != _sessionRevision || busy || loading) return;
    final product = productFor(bookId);
    if (_userId == null ||
        _accountToken == null ||
        !available ||
        product == null) {
      message = 'This purchase is not available yet. Please try again later.';
      _notify();
      return;
    }
    _checkout = true;
    message = null;
    verifiedBookId = null;
    _notify();
    try {
      final started = await _store.buyNonConsumable(
        purchaseParam: PurchaseParam(
          productDetails: product,
          applicationUserName: _accountToken,
        ),
      );
      if (revision != _sessionRevision || _disposed) return;
      if (!started) {
        _checkout = false;
        message = 'The store could not start this purchase.';
        _notify();
      }
    } catch (error) {
      if (revision != _sessionRevision || _disposed) return;
      _checkout = false;
      message = api.errorMessage(error);
      _notify();
    }
  }

  Future<void> restore() async {
    if (_disposed || busy || loading || _userId == null || !supported) return;
    if (_accountToken == null) await reload();
    if (_disposed || _accountToken == null || !available || busy) return;
    final revision = _sessionRevision;
    _restoring = true;
    // An explicit restore must query the backend again, even for previously delivered books.
    _completedTransactions.clear();
    message = 'Checking previous purchases…';
    _notify();
    try {
      await _store.restorePurchases(applicationUserName: _accountToken);
      if (revision != _sessionRevision || _disposed) return;
      await _queue;
      if (_retryPurchases.isNotEmpty) {
        await _enqueue(_retryPurchases.values.toList());
      }
      if (message == 'Checking previous purchases…') {
        message =
            'Restore requested. Verified books will appear in your library.';
      }
    } catch (error) {
      if (revision == _sessionRevision) message = api.errorMessage(error);
    } finally {
      if (revision == _sessionRevision) {
        _restoring = false;
        _notify();
      }
    }
  }

  Future<void> _enqueue(List<PurchaseDetails> purchases) {
    final updates = List<PurchaseDetails>.of(purchases);
    _queue = _queue.then((_) => _process(updates));
    return _queue;
  }

  Future<void> _process(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      if (_disposed) return;
      if (purchase.status == PurchaseStatus.pending) {
        _checkout = false;
        _pendingProducts.add(purchase.productID);
        message = 'Payment is pending. Your book unlocks after confirmation.';
        _notify();
        continue;
      }
      if (purchase.status == PurchaseStatus.error ||
          purchase.status == PurchaseStatus.canceled) {
        _checkout = false;
        _pendingProducts.remove(purchase.productID);
        message = purchase.status == PurchaseStatus.canceled
            ? 'Purchase cancelled.'
            : (purchase.error?.message ?? 'Purchase failed.');
        _notify();
        if (purchase.pendingCompletePurchase) {
          try {
            await _store.completePurchase(purchase);
          } catch (_) {
            // Failed/cancelled transactions never grant ownership.
          }
        }
        continue;
      }
      _checkout = false;
      _pendingProducts.remove(purchase.productID);
      final proof = _platform == 'android'
          ? purchase.verificationData.serverVerificationData
          : purchase.purchaseID;
      final key = '${purchase.productID}:$proof';
      if (_completedTransactions.contains(key)) {
        _notify();
        continue;
      }
      _retryPurchases[key] = purchase;
      final userId = _userId;
      if (userId == null) continue;
      final revision = _sessionRevision;
      _verifying++;
      _notify();
      try {
        final response = await api.dio.post(
          '/payments/store/verify',
          data: {
            'store': _platform,
            'productId': purchase.productID,
            'transactionId': purchase.purchaseID,
            'verificationData': _platform == 'android'
                ? purchase.verificationData.serverVerificationData
                : '',
          },
        );
        if (revision != _sessionRevision || _disposed) continue;
        if (response.data['success'] != true ||
            response.data['bookId'] is! String ||
            response.data['purchasedBookIds'] is! List ||
            !(response.data['purchasedBookIds'] as List).contains(
              response.data['bookId'],
            )) {
          throw StateError('Purchase was not verified.');
        }
        final ids = (response.data['purchasedBookIds'] as List)
            .map((id) => id.toString())
            .toList();
        await onVerified(userId, ids);
        if (revision != _sessionRevision || _disposed) continue;
        if (purchase.pendingCompletePurchase) {
          await _store.completePurchase(purchase);
        }
        _retryPurchases.remove(key);
        _completedTransactions.add(key);
        if (revision != _sessionRevision || _disposed) continue;
        verifiedBookId = response.data['bookId'] as String;
        message = 'Purchase verified. Your story is unlocked.';
      } catch (error) {
        // Keep the transaction unfinished; Restore retries server verification.
        if (revision == _sessionRevision) message = api.errorMessage(error);
      } finally {
        _verifying--;
        _notify();
      }
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(_subscription?.cancel());
    super.dispose();
  }
}
