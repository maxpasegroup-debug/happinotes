import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:happinotes_flutter/core/network/api_client.dart';
import 'package:happinotes_flutter/core/payments/store_purchase_controller.dart';

class _Api extends ApiClient {
  _Api() : super(apiBaseUrl: 'http://127.0.0.1:5000', releaseBuild: false);

  @override
  Future<String?> readToken() async => 'test';
}

class _Adapter implements HttpClientAdapter {
  bool failVerification = false;
  bool malformedVerification = false;
  Completer<void>? verificationGate;
  Map<String, dynamic>? verificationPayload;
  int verifications = 0;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path.endsWith('/products')) {
      return ResponseBody.fromString(
        jsonEncode({
          'accountToken': 'account-token',
          'products': [
            {
              'bookId': 'book',
              'android': 'book.product',
              'ios': 'book.product',
            },
          ],
        }),
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    }
    verifications++;
    verificationPayload = Map<String, dynamic>.from(options.data as Map);
    await verificationGate?.future;
    return ResponseBody.fromString(
      jsonEncode(
        failVerification
            ? {'message': 'Verification unavailable'}
            : {
                'success': true,
                'bookId': 'book',
                'purchasedBookIds': malformedVerification ? [] : ['book'],
              },
      ),
      failVerification ? 503 : 200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _Store extends InAppPurchasePlatform {
  final updates = StreamController<List<PurchaseDetails>>.broadcast();
  int completions = 0;
  int restorations = 0;
  int queries = 0;
  bool available = true;
  bool missingProduct = false;
  bool checkoutStarted = true;
  bool completionFails = false;
  List<PurchaseDetails> restored = [];
  PurchaseParam? purchasedWith;
  @override
  Stream<List<PurchaseDetails>> get purchaseStream => updates.stream;
  @override
  Future<bool> isAvailable() async => available;
  @override
  Future<ProductDetailsResponse> queryProductDetails(
    Set<String> identifiers,
  ) async {
    queries++;
    return ProductDetailsResponse(
      productDetails: missingProduct
          ? []
          : [
              ProductDetails(
                id: 'book.product',
                title: 'Book',
                description: 'Story',
                price: '₹99',
                rawPrice: 99,
                currencyCode: 'INR',
              ),
            ],
      notFoundIDs: missingProduct ? ['book.product'] : [],
    );
  }

  @override
  Future<bool> buyNonConsumable({required PurchaseParam purchaseParam}) async {
    purchasedWith = purchaseParam;
    return checkoutStarted;
  }

  @override
  Future<void> completePurchase(PurchaseDetails purchase) async {
    if (completionFails) throw StateError('Store completion unavailable');
    completions++;
  }

  @override
  Future<void> restorePurchases({String? applicationUserName}) async {
    restorations++;
    if (restored.isNotEmpty) updates.add(restored);
  }
}

PurchaseDetails _purchase(PurchaseStatus status) => PurchaseDetails(
  productID: 'book.product',
  purchaseID: 'transaction',
  transactionDate: '1',
  verificationData: PurchaseVerificationData(
    localVerificationData: '',
    serverVerificationData: 'purchase-token',
    source: 'google_play',
  ),
  status: status,
)..pendingCompletePurchase = true;

Future<void> _settle() async {
  for (var i = 0; i < 15; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _Store store;
  late _Adapter adapter;
  late StorePurchaseController controller;
  late List<String> unlocked;
  setUp(() async {
    debugDefaultTargetPlatformOverride = TargetPlatform.windows;
    // Initialize plugin registration before installing the fake platform.
    InAppPurchase.instance;
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    store = _Store();
    InAppPurchasePlatform.instance = store;
    adapter = _Adapter();
    final api = _Api()..dio.httpClientAdapter = adapter;
    unlocked = [];
    controller = StorePurchaseController(api, (userId, ids) async {
      unlocked = ids;
    });
    controller.setUser('user');
    await _settle();
  });
  tearDown(() async {
    controller.dispose();
    await store.updates.close();
    debugDefaultTargetPlatformOverride = null;
  });

  test(
    'checkout uses the store product and server-owned account binding',
    () async {
      expect(controller.productFor('book')?.price, '₹99');
      await controller.buy('book');
      expect(store.purchasedWith?.applicationUserName, 'account-token');
      expect(store.purchasedWith?.productDetails.id, 'book.product');
    },
  );

  test('pending payment never verifies, unlocks, or completes', () async {
    store.updates.add([_purchase(PurchaseStatus.pending)]);
    await _settle();
    expect(adapter.verifications, 0);
    expect(unlocked, isEmpty);
    expect(store.completions, 0);
    expect(controller.pendingFor('book'), isTrue);
    expect(controller.busy, isFalse);
    await controller.restore();
    expect(store.restorations, 1);
    expect(unlocked, isEmpty);
  });

  test(
    'failed verification retains the transaction for a successful restore retry',
    () async {
      adapter.failVerification = true;
      store.updates.add([_purchase(PurchaseStatus.purchased)]);
      await _settle();
      expect(unlocked, isEmpty);
      expect(store.completions, 0);
      adapter.failVerification = false;
      await controller.restore();
      expect(unlocked, ['book']);
      expect(store.completions, 1);
    },
  );

  test('restored purchase unlocks only after server verification', () async {
    store.updates.add([_purchase(PurchaseStatus.restored)]);
    await _settle();
    expect(adapter.verifications, 1);
    expect(unlocked, ['book']);
    expect(store.completions, 1);
  });

  test(
    'signed-out purchase updates are retained without granting access',
    () async {
      controller.setUser(null);
      store.updates.add([_purchase(PurchaseStatus.purchased)]);
      await _settle();
      expect(adapter.verifications, 0);
      expect(unlocked, isEmpty);
      expect(store.completions, 0);
      controller.setUser('user');
      await _settle();
      expect(unlocked, ['book']);
    },
  );

  for (final status in [PurchaseStatus.canceled, PurchaseStatus.error]) {
    test('$status releases checkout without unlocking a book', () async {
      await controller.buy('book');
      expect(controller.busy, isTrue);
      store.updates.add([_purchase(status)]);
      await _settle();
      expect(controller.busy, isFalse);
      expect(adapter.verifications, 0);
      expect(unlocked, isEmpty);
    });
  }

  test(
    'pending purchase cannot start a second checkout and later verifies normally',
    () async {
      store.updates.add([_purchase(PurchaseStatus.pending)]);
      await _settle();
      await controller.buy('book');
      expect(store.purchasedWith, isNull);
      store.updates.add([_purchase(PurchaseStatus.purchased)]);
      await _settle();
      expect(controller.pendingFor('book'), isFalse);
      expect(unlocked, ['book']);
    },
  );

  test(
    'repeated callbacks are processed once until the user explicitly restores',
    () async {
      final purchase = _purchase(PurchaseStatus.purchased);
      store.updates.add([purchase, purchase]);
      await _settle();
      expect(adapter.verifications, 1);
      expect(store.completions, 1);
      store.restored = [_purchase(PurchaseStatus.restored)];
      await controller.restore();
      expect(adapter.verifications, 2);
    },
  );

  test(
    'restore sends the transaction through verification before granting access',
    () async {
      adapter.verificationGate = Completer<void>();
      store.restored = [_purchase(PurchaseStatus.restored)];
      final restore = controller.restore();
      await _settle();
      expect(controller.busy, isTrue);
      expect(unlocked, isEmpty);
      expect(store.completions, 0);
      adapter.verificationGate!.complete();
      await restore;
      expect(unlocked, ['book']);
      expect(controller.busy, isFalse);
    },
  );

  test(
    'empty restore ends checking without reporting a verified unlock',
    () async {
      await controller.restore();
      expect(controller.busy, isFalse);
      expect(controller.message, contains('Restore requested'));
      expect(unlocked, isEmpty);
    },
  );

  test(
    'signing out during verification prevents applying the previous account result',
    () async {
      adapter.verificationGate = Completer<void>();
      store.updates.add([_purchase(PurchaseStatus.purchased)]);
      await _settle();
      controller.setUser(null);
      adapter.verificationGate!.complete();
      await _settle();
      expect(unlocked, isEmpty);
      expect(store.completions, 0);
    },
  );

  test(
    'missing product and unavailable store cannot use a stale checkout product',
    () async {
      store.missingProduct = true;
      await controller.buy('book');
      expect(store.purchasedWith, isNull);
      store.missingProduct = false;
      store.available = false;
      await controller.reload();
      expect(controller.productFor('book'), isNull);
      expect(unlocked, isEmpty);
    },
  );

  test('native checkout refusal clears the busy state', () async {
    store.checkoutStarted = false;
    await controller.buy('book');
    expect(controller.busy, isFalse);
    expect(unlocked, isEmpty);
  });

  test(
    'malformed verification response cannot grant access or finish the transaction',
    () async {
      adapter.malformedVerification = true;
      store.updates.add([_purchase(PurchaseStatus.purchased)]);
      await _settle();
      expect(unlocked, isEmpty);
      expect(store.completions, 0);
    },
  );

  test(
    'a failed store completion remains retryable after backend verified ownership',
    () async {
      store.completionFails = true;
      store.updates.add([_purchase(PurchaseStatus.purchased)]);
      await _settle();
      expect(unlocked, ['book']);
      expect(store.completions, 0);
      store.completionFails = false;
      await controller.restore();
      expect(store.completions, 1);
    },
  );

  test(
    'iOS restoration uses transaction ID and the existing verification endpoint',
    () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      await controller.reload();
      store.restored = [_purchase(PurchaseStatus.restored)];
      await controller.restore();
      expect(adapter.verificationPayload!['store'], 'ios');
      expect(adapter.verificationPayload!['transactionId'], 'transaction');
      expect(adapter.verificationPayload!['verificationData'], '');
      expect(unlocked, ['book']);
    },
  );
}
