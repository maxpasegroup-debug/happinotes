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
  Future<void> load() async {
    try {
      plans = await repository.getPlans();
      if (plans.isNotEmpty) {
        selected = plans.any((p) => p.id == 'yearly')
            ? 'yearly'
            : plans.first.id;
      }
    } catch (e) {
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
