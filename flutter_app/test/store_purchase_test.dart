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
  @override
  Future<String?> readToken() async => 'test';
}

class _Adapter implements HttpClientAdapter {
  bool failVerification = false;
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
            {'bookId': 'book', 'android': 'book.product'},
          ],
        }),
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    }
    verifications++;
    return ResponseBody.fromString(
      jsonEncode(
        failVerification
            ? {'message': 'Verification unavailable'}
            : {
                'success': true,
                'bookId': 'book',
                'purchasedBookIds': ['book'],
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
  PurchaseParam? purchasedWith;
  @override
  Stream<List<PurchaseDetails>> get purchaseStream => updates.stream;
  @override
  Future<bool> isAvailable() async => true;
  @override
  Future<ProductDetailsResponse> queryProductDetails(
    Set<String> identifiers,
  ) async => ProductDetailsResponse(
    productDetails: [
      ProductDetails(
        id: 'book.product',
        title: 'Book',
        description: 'Story',
        price: '₹99',
        rawPrice: 99,
        currencyCode: 'INR',
      ),
    ],
    notFoundIDs: [],
  );
  @override
  Future<bool> buyNonConsumable({required PurchaseParam purchaseParam}) async {
    purchasedWith = purchaseParam;
    return true;
  }

  @override
  Future<void> completePurchase(PurchaseDetails purchase) async {
    completions++;
  }

  @override
  Future<void> restorePurchases({String? applicationUserName}) async {}
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
}
