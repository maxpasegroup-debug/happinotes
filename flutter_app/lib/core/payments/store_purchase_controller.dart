import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../network/api_client.dart';

class StorePurchaseController extends ChangeNotifier {
  StorePurchaseController(this.api, this.onVerified) {
    if (!supported) return;
    _subscription = _store.purchaseStream.listen(
      (purchases) {
        _queue = _queue.then((_) => _process(purchases));
      },
      onError: (Object error) {
        message =
            'Could not receive purchase updates. Please restore purchases.';
        busy = false;
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
  String? _userId;
  String? _accountToken;
  bool _disposed = false;
  bool available = false;
  bool loading = false;
  bool busy = false;
  String? message;
  String? verifiedBookId;
  bool get supported =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);
  String get _platform =>
      defaultTargetPlatform == TargetPlatform.android ? 'android' : 'ios';
  ProductDetails? productFor(String bookId) => _products[_bookProducts[bookId]];

  void setUser(String? userId) {
    if (_userId == userId) return;
    _userId = userId;
    _accountToken = null;
    _bookProducts.clear();
    _products.clear();
    message = null;
    verifiedBookId = null;
    busy = false;
    unawaited(reload());
  }

  Future<void> reload() async {
    final userId = _userId;
    if (userId == null || !supported) {
      available = false;
      loading = false;
      _notify();
      return;
    }
    loading = true;
    message = null;
    _notify();
    try {
      final storeAvailable = await _store.isAvailable();
      if (userId != _userId || _disposed) return;
      available = storeAvailable;
      if (!available) {
        throw StateError('The app store is unavailable on this device.');
      }
      final response = await api.dio.get('/payments/store/products');
      if (userId != _userId || _disposed) return;
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
        if (userId != _userId || _disposed) return;
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
        _queue = _queue.then((_) => _process(retries));
      }
    } catch (error) {
      if (userId == _userId) message = api.errorMessage(error);
    } finally {
      if (userId == _userId) {
        loading = false;
        _notify();
      }
    }
  }

  Future<void> buy(String bookId) async {
    final product = productFor(bookId);
    if (busy || loading) return;
    if (_userId == null ||
        _accountToken == null ||
        !available ||
        product == null) {
      message = 'This purchase is not available yet. Please try again later.';
      _notify();
      return;
    }
    busy = true;
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
      if (!started) {
        busy = false;
        message = 'The store could not start this purchase.';
        _notify();
      }
    } catch (error) {
      busy = false;
      message = api.errorMessage(error);
      _notify();
    }
  }

  Future<void> restore() async {
    if (busy || loading || _userId == null || !supported) return;
    busy = true;
    message = 'Checking previous purchases…';
    _notify();
    try {
      await _store.restorePurchases(applicationUserName: _accountToken);
      await _queue;
      if (_retryPurchases.isNotEmpty) {
        await _process(_retryPurchases.values.toList());
      }
      message ??=
          'Restore requested. Verified books will appear in your library.';
    } catch (error) {
      message = api.errorMessage(error);
    } finally {
      busy = false;
      _notify();
    }
  }

  Future<void> _process(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      if (_disposed) return;
      if (purchase.status == PurchaseStatus.pending) {
        busy = true;
        message = 'Payment is pending. Your book unlocks after confirmation.';
        _notify();
        continue;
      }
      if (purchase.status == PurchaseStatus.error ||
          purchase.status == PurchaseStatus.canceled) {
        busy = false;
        message = purchase.status == PurchaseStatus.canceled
            ? 'Purchase cancelled.'
            : (purchase.error?.message ?? 'Purchase failed.');
        _notify();
        continue;
      }
      final key = '${purchase.productID}:${purchase.purchaseID}';
      _retryPurchases[key] = purchase;
      final userId = _userId;
      if (userId == null) continue;
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
        if (userId != _userId || _disposed) continue;
        if (response.data['success'] != true) {
          throw StateError('Purchase was not verified.');
        }
        final ids = (response.data['purchasedBookIds'] as List)
            .map((id) => id.toString())
            .toList();
        await onVerified(userId, ids);
        if (purchase.pendingCompletePurchase) {
          await _store.completePurchase(purchase);
        }
        _retryPurchases.remove(key);
        if (userId != _userId || _disposed) continue;
        verifiedBookId = response.data['bookId'] as String;
        message = 'Purchase verified. Your story is unlocked.';
      } catch (error) {
        // Keep the transaction unfinished; Restore retries server verification.
        if (userId == _userId) message = api.errorMessage(error);
      } finally {
        busy = false;
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
