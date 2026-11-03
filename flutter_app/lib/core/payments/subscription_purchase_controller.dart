import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../network/api_client.dart';

class SubscriptionPlanDetails {
  const SubscriptionPlanDetails({
    required this.key,
    required this.productId,
    required this.billingPeriod,
    required this.regionalPricing,
  });
  final String key;
  final String productId;
  final String billingPeriod;
  final List<SubscriptionMarketPrice> regionalPricing;
}

class SubscriptionMarketPrice {
  const SubscriptionMarketPrice({
    required this.currencyCode,
    required this.regularPrice,
    required this.offerPrice,
  });
  final String currencyCode;
  final double regularPrice;
  final double offerPrice;
}

class SubscriptionPurchaseController extends ChangeNotifier {
  SubscriptionPurchaseController(this.api, this.onVerified) {
    if (!supported) return;
    _subscription = _store.purchaseStream.listen(
      _enqueue,
      onError: (Object error) {
        message =
            'Could not receive subscription updates. Please restore purchases.';
        _checkout = false;
        _notify();
      },
    );
  }

  final ApiClient api;
  final Future<void> Function(
    bool active,
    String? plan,
    DateTime? expiresAt,
    bool? autoRenewing,
    String? productId,
  )
  onVerified;
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
  String? _activeProductId;
  String? _accountToken;
  int _revision = 0;
  int _verifying = 0;
  bool _checkout = false;
  bool _restoring = false;
  bool _disposed = false;
  bool available = false;
  bool loading = false;
  String? message;

  bool get supported =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);
  String get _platform =>
      defaultTargetPlatform == TargetPlatform.android ? 'android' : 'ios';
  bool get busy => _checkout || _restoring || _verifying > 0;
  List<SubscriptionPlanDetails> get plans =>
      _plans.values.toList(growable: false);
  ProductDetails? productFor(String key) {
    final plan = _plans[key];
    return plan == null ? null : _products[plan.productId];
  }

  ProductDetails? productById(String? productId) =>
      productId == null ? null : _products[productId];

  SubscriptionMarketPrice? offerFor(String key) {
    final plan = _plans[key];
    final product = productFor(key);
    if (plan == null || product == null) return null;
    final matching = plan.regionalPricing
        .where(
          (row) =>
              row.currencyCode == product.currencyCode &&
              (row.offerPrice - product.rawPrice).abs() < 0.01 &&
              row.regularPrice > row.offerPrice,
        )
        .toList();
    if (matching.isEmpty) return null;
    final first = matching.first;
    return matching.every(
          (row) =>
              row.regularPrice == first.regularPrice &&
              row.offerPrice == first.offerPrice,
        )
        ? first
        : null;
  }

  bool pendingFor(String key) =>
      _pendingProducts.contains(_plans[key]?.productId);

  void setUser(String? userId, {String? activeProductId}) {
    if (_userId == userId && _activeProductId == activeProductId) return;
    final userChanged = _userId != userId;
    _userId = userId;
    _activeProductId = activeProductId;
    _revision++;
    _reloadFuture = null;
    _accountToken = null;
    if (userChanged) _plans.clear();
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
    return _reloadFuture ??= _reload(
      _revision,
    ).whenComplete(() => _reloadFuture = null);
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
        final rawStoreIds = raw['storeProductIds'];
        final productId = rawStoreIds is Map
            ? rawStoreIds[_platform]?.toString()
            : null;
        if (key != null && productId != null && productId.isNotEmpty) {
          _plans[key] = SubscriptionPlanDetails(
            key: key,
            productId: productId,
            billingPeriod: raw['billingPeriod']?.toString() ?? '',
            regionalPricing: ((raw['regionalPricing'] as List?) ?? const [])
                .whereType<Map>()
                .map(
                  (row) => SubscriptionMarketPrice(
                    currencyCode: row['currencyCode']?.toString() ?? '',
                    regularPrice:
                        (row['regularPrice'] as num?)?.toDouble() ?? 0,
                    offerPrice: (row['offerPrice'] as num?)?.toDouble() ?? 0,
                  ),
                )
                .toList(growable: false),
          );
        }
      }
      available = await _store.isAvailable();
      if (!available) {
        message = 'The app store is unavailable on this device.';
        return;
      }
      if (_plans.isNotEmpty) {
        final productIds = _plans.values.map((p) => p.productId).toSet();
        if (_activeProductId != null && _activeProductId!.isNotEmpty)
          productIds.add(_activeProductId!);
        final details = await _store.queryProductDetails(productIds);
        if (revision != _revision || _disposed) return;
        if (details.error != null) throw StateError(details.error!.message);
        for (final product in details.productDetails) {
          _products[product.id] = product;
        }
        if (details.notFoundIDs.isNotEmpty) {
          message = 'Some subscription plans are not available yet.';
        }
      }
      if (_retryPurchases.isNotEmpty) {
        await _enqueue(_retryPurchases.values.toList());
      }
    } catch (error) {
      if (revision == _revision) message = api.errorMessage(error);
    } finally {
      if (revision == _revision) {
        loading = false;
        _notify();
      }
    }
  }

  Future<void> buy(String key) async {
    if (_disposed || busy || loading || pendingFor(key)) return;
    final revision = _revision;
    await reload();
    if (revision != _revision || _disposed) return;
    final product = productFor(key);
    if (_userId == null || !available || product == null) {
      message =
          'This subscription plan is not available yet. Please try again later.';
      _notify();
      return;
    }
    _checkout = true;
    message = null;
    _notify();
    try {
      final started = await _store.buyNonConsumable(
        purchaseParam: PurchaseParam(
          productDetails: product,
          applicationUserName: _accountToken,
        ),
      );
      if (revision != _revision || _disposed) return;
      if (!started) {
        _checkout = false;
        message = 'The store could not start this subscription.';
        _notify();
      }
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
      if (revision == _revision &&
          message == 'Checking previous subscriptions…') {
        message = 'Restore requested.';
      }
    } catch (error) {
      if (revision == _revision) message = api.errorMessage(error);
    } finally {
      if (revision == _revision) {
        _restoring = false;
        _notify();
      }
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
      if (purchase.status == PurchaseStatus.error ||
          purchase.status == PurchaseStatus.canceled) {
        _checkout = false;
        _pendingProducts.remove(purchase.productID);
        message = purchase.status == PurchaseStatus.canceled
            ? 'Subscription cancelled.'
            : (purchase.error?.message ?? 'Subscription failed.');
        _notify();
        if (purchase.pendingCompletePurchase) {
          try {
            await _store.completePurchase(purchase);
          } catch (_) {}
        }
        continue;
      }
      _checkout = false;
      _pendingProducts.remove(purchase.productID);
      final proof = _platform == 'android'
          ? purchase.verificationData.serverVerificationData
          : purchase.purchaseID;
      if (proof == null || proof.isEmpty) continue;
      final key = '${purchase.productID}:$proof';
      if (_completedTransactions.contains(key)) continue;
      _retryPurchases[key] = purchase;
      if (_userId == null) continue;
      _verifying++;
      _notify();
      try {
        final response = await api.dio.post(
          '/payments/store/subscription-verify',
          data: {
            'store': _platform,
            'productId': purchase.productID,
            'transactionId': purchase.purchaseID,
            'verificationData': _platform == 'android' ? proof : '',
            'restore': _restoring,
          },
        );
        final active = response.data['subscriptionActive'] == true;
        final plan = response.data['subscriptionPlan']?.toString();
        final expires = response.data['subscriptionExpiresAt'] == null
            ? null
            : DateTime.tryParse(
                response.data['subscriptionExpiresAt'].toString(),
              );
        final autoRenewing = response.data['subscriptionAutoRenewing'] as bool?;
        final subscriptionProductId =
            response.data['subscriptionProductId']?.toString() ??
            purchase.productID;
        await onVerified(
          active,
          plan,
          expires,
          autoRenewing,
          subscriptionProductId,
        );
        if (purchase.pendingCompletePurchase) {
          await _store.completePurchase(purchase);
        }
        _retryPurchases.remove(key);
        _completedTransactions.add(key);
        message = active
            ? 'Subscription activated.'
            : 'Subscription is not active.';
      } catch (error) {
        message = api.errorMessage(error);
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
