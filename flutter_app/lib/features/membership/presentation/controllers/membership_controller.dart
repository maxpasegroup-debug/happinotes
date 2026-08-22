import 'package:flutter/foundation.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../../../../core/network/api_client.dart';
import '../../../auth/presentation/controllers/session_controller.dart';
import '../../domain/entities/plan.dart';
import '../../domain/repositories/membership_repository.dart';

class MembershipController extends ChangeNotifier {
  MembershipController(this.repository, this.session, this.client) {
    razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _success)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _failure)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _wallet);
    load();
  }
  final MembershipRepository repository;
  final SessionController session;
  final ApiClient client;
  late final Razorpay razorpay;
  List<MembershipPlan> plans = [];
  String? selected, error;
  bool loading = true, paying = false;
  int activationCount = 0;

  // These mirror the backend defaults. They keep the membership UI useful if
  // the plans request is temporarily unavailable; checkout still uses the
  // backend and will report an error until the service is reachable.
  static const _defaultPlans = <MembershipPlan>[
    MembershipPlan(
      id: 'monthly',
      name: 'Monthly',
      price: 499,
      durationDays: 30,
    ),
    MembershipPlan(
      id: 'yearly',
      name: 'Yearly',
      price: 4999,
      durationDays: 365,
    ),
  ];

  Future<void> load() async {
    try {
      plans = await repository.getPlans();
      if (plans.isEmpty) {
        plans = _defaultPlans;
        error = 'Membership plans are temporarily unavailable. Please try again.';
      }
      if (plans.isNotEmpty) {
        selected = plans.any((p) => p.id == 'yearly')
            ? 'yearly'
            : plans.first.id;
      }
    } catch (e) {
      plans = _defaultPlans;
      selected = 'yearly';
      error = client.errorMessage(e);
    }
    loading = false;
    notifyListeners();
  }

  void select(String id) {
    selected = id;
    notifyListeners();
  }

  Future<void> pay() async {
    if (selected == null) return;
    paying = true;
    error = null;
    notifyListeners();
    try {
      final order = await repository.createOrder(selected!);
      razorpay.open({
        'key': order['keyId'],
        'amount': (order['amount'] as num).toInt() * 100,
        'currency': order['currency'],
        'name': 'HappiNotes',
        'description': order['plan']['name'],
        'order_id': order['orderId'],
        'prefill': {
          'name': session.user?.name ?? '',
          'contact': session.user?.phoneNumber ?? '',
        },
        'theme': {'color': '#F25F45'},
      });
    } catch (e) {
      paying = false;
      error = client.errorMessage(e);
      notifyListeners();
    }
  }

  Future<void> _success(PaymentSuccessResponse value) async {
    try {
      final user = await repository.verifyPayment(
        orderId: value.orderId!,
        paymentId: value.paymentId!,
        signature: value.signature!,
      );
      session.replaceUser(user);
      activationCount++;
    } catch (e) {
      error = client.errorMessage(e);
    }
    paying = false;
    notifyListeners();
  }

  void _failure(PaymentFailureResponse value) {
    paying = false;
    error = value.message ?? 'Payment failed or was cancelled.';
    notifyListeners();
  }

  void _wallet(ExternalWalletResponse value) {}
  @override
  void dispose() {
    razorpay.clear();
    super.dispose();
  }
}
