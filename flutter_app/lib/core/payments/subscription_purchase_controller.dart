import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../network/api_client.dart';

class SubscriptionPlanDetails {
  const SubscriptionPlanDetails({required this.key, required this.productId, required this.billingPeriod, required this.priceInr});
  final String key;
  final String productId;
  final String billingPeriod;
  final double priceInr;
}

class SubscriptionPurchaseController extends ChangeNotifier {
  SubscriptionPurchaseController(this.api, this.onVerified) {
    if (!supported) return;
    _subscription = _store.purchaseStream.listen(_enqueue, onError: (Object error) {
      message = 'Could not receive subscription updates. Please restore purchases.';
      _checkout = false;
      _notify();
    });
  }

  final ApiClient api;
  final Future<void> Function(bool active, String? plan, DateTime? expiresAt) onVerified;
  final InAppPurchase _store = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _subscription;
  Future<void> _queue = Future<void>.value();
  final Map<String, SubscriptionPlanDetails> _plans = {};
  final Map<String, ProductDetails> _products = {};
  final Map<String, PurchaseDetails> _retryPurchases = {};
  final Set<String> _completedTransactions = {};
  final Set<String> _pendingProducts = {};
  Future<void>? _reloadFuture;
  String? _userId;
  String? _accountToken;
  int _revision = 0;
  int _verifying = 0;
  bool _checkout = false;
  bool _restoring = false;
  bool _disposed = false;
  bool available = false;
  bool loading = false;
  String? message;

  bool get supported => !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS);
  String get _platform => defaultTargetPlatform == TargetPlatform.android ? 'android' : 'ios';
  bool get busy => _checkout || _restoring || _verifying > 0;
  List<SubscriptionPlanDetails> get plans => _plans.values.toList(growable: false);
  ProductDetails? productFor(String key) {
    final plan = _plans[key];
    return plan == null ? null : _products[plan.productId];
  }
  bool pendingFor(String key) => _pendingProducts.contains(_plans[key]?.productId);

  void setUser(String? userId) {
    if (_userId == userId) return;
    _userId = userId;
    _revision++;
    _reloadFuture = null;
    _accountToken = null;
    _plans.clear();
    _products.clear();
    _retryPurchases.clear();
    _completedTransactions.clear();
    _pendingProducts.clear();
    message = null;
    _checkout = false;
    _restoring = false;
    unawaited(reload());
  }

  Future<void> reload() {
    if (_disposed) return Future<void>.value();
    return _reloadFuture ??= _reload(_revision).whenComplete(() => _reloadFuture = null);
  }

  Future<void> _reload(int revision) async {
    if (_userId == null || !supported) {
      available = false;
      loading = false;
      _notify();
      return;
    }
    loading = true;
    message = null;
    _products.clear();
    _notify();
    try {
      final response = await api.dio.get('/payments/store/subscription-plans');
      if (revision != _revision || _disposed) return;
      _accountToken = response.data['accountToken']?.toString();
      _plans.clear();
      for (final raw in (response.data['plans'] as List? ?? const [])) {
        if (raw is! Map) continue;
        final key = raw['key']?.toString();
        final productId = raw[_platform]?.toString() ?? raw['productId']?.toString();
        if (key != null && productId != null && productId.isNotEmpty) {
          final rawPrice = raw['priceInr'];
          final priceInr = rawPrice is num
              ? rawPrice.toDouble()
              : double.tryParse(rawPrice?.toString() ?? '') ?? 0;
          _plans[key] = SubscriptionPlanDetails(
            key: key,
            productId: productId,
            billingPeriod: raw['billingPeriod']?.toString() ?? '',
            priceInr: priceInr,
          );
        }
      }
      available = await _store.isAvailable();
      if (!available) {
        message = 'The app store is unavailable on this device.';
        return;
      }
      if (_plans.isNotEmpty) {
        final details = await _store.queryProductDetails(_plans.values.map((p) => p.productId).toSet());
        if (revision != _revision || _disposed) return;
        if (details.error != null) throw StateError(details.error!.message);
        for (final product in details.productDetails) _products[product.id] = product;
        if (details.notFoundIDs.isNotEmpty) message = 'Some subscription plans are not available yet.';
      }
      if (_retryPurchases.isNotEmpty) await _enqueue(_retryPurchases.values.toList());
    } catch (error) {
      if (revision == _revision) message = api.errorMessage(error);
    } finally {
      if (revision == _revision) { loading = false; _notify(); }
    }
  }

  Future<void> buy(String key) async {
    if (_disposed || busy || loading || pendingFor(key)) return;
    final revision = _revision;
    await reload();
    final product = productFor(key);
    if (_userId == null || !available || product == null) {
      message = 'This subscription plan is not available yet. Please try again later.';
      _notify();
      return;
    }
    _checkout = true;
    message = null;
    _notify();
    try {
      final started = await _store.buyNonConsumable(
        purchaseParam: PurchaseParam(productDetails: product, applicationUserName: _accountToken),
      );
      if (revision != _revision || _disposed) return;
      if (!started) { _checkout = false; message = 'The store could not start this subscription.'; _notify(); }
    } catch (error) {
      if (revision != _revision || _disposed) return;
      _checkout = false;
      message = api.errorMessage(error);
      _notify();
    }
  }

  Future<void> restore() async {
    if (_disposed || busy || loading || _userId == null || !supported) return;
    if (_accountToken == null) await reload();
    if (_accountToken == null || !available || busy) return;
    final revision = _revision;
    _restoring = true;
    _completedTransactions.clear();
    message = 'Checking previous subscriptions…';
    _notify();
    try {
      await _store.restorePurchases(applicationUserName: _accountToken);
      await _queue;
      if (revision == _revision && message == 'Checking previous subscriptions…') message = 'Restore requested.';
    } catch (error) {
      if (revision == _revision) message = api.errorMessage(error);
    } finally {
      if (revision == _revision) { _restoring = false; _notify(); }
    }
  }

  Future<void> _enqueue(List<PurchaseDetails> purchases) {
    _queue = _queue.then((_) => _process(purchases));
    return _queue;
  }

  Future<void> _process(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      if (_disposed) return;
      if (purchase.status == PurchaseStatus.pending) {
        _checkout = false;
        _pendingProducts.add(purchase.productID);
        message = 'Subscription payment is pending.';
        _notify();
        continue;
      }
      if (purchase.status == PurchaseStatus.error || purchase.status == PurchaseStatus.canceled) {
        _checkout = false;
        _pendingProducts.remove(purchase.productID);
        message = purchase.status == PurchaseStatus.canceled ? 'Subscription cancelled.' : (purchase.error?.message ?? 'Subscription failed.');
        _notify();
        if (purchase.pendingCompletePurchase) { try { await _store.completePurchase(purchase); } catch (_) {} }
        continue;
      }
      _checkout = false;
      _pendingProducts.remove(purchase.productID);
      final proof = _platform == 'android' ? purchase.verificationData.serverVerificationData : purchase.purchaseID;
      if (proof == null || proof.isEmpty) continue;
      final key = '${purchase.productID}:$proof';
      if (_completedTransactions.contains(key)) continue;
      _retryPurchases[key] = purchase;
      if (_userId == null) continue;
      _verifying++;
      _notify();
      try {
        final response = await api.dio.post('/payments/store/subscription-verify', data: {
          'store': _platform,
          'productId': purchase.productID,
          'transactionId': purchase.purchaseID,
          'verificationData': _platform == 'android' ? proof : '',
          'restore': _restoring,
        });
        final active = response.data['subscriptionActive'] == true;
        final plan = response.data['subscriptionPlan']?.toString();
        final expires = response.data['subscriptionExpiresAt'] == null ? null : DateTime.tryParse(response.data['subscriptionExpiresAt'].toString());
        await onVerified(active, plan, expires);
        if (purchase.pendingCompletePurchase) await _store.completePurchase(purchase);
        _retryPurchases.remove(key);
        _completedTransactions.add(key);
        message = active ? 'Subscription activated.' : 'Subscription is not active.';
      } catch (error) {
        message = api.errorMessage(error);
      } finally {
        _verifying--;
        _notify();
      }
    }
  }

  void _notify() { if (!_disposed) notifyListeners(); }

  @override
  void dispose() { _disposed = true; unawaited(_subscription?.cancel()); super.dispose(); }
}
