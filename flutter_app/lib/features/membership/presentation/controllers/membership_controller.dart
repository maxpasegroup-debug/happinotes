import 'package:flutter/foundation.dart';
import '../../../../core/network/api_client.dart';
import '../../../auth/presentation/controllers/session_controller.dart';
import '../../domain/entities/plan.dart';
import '../../domain/repositories/membership_repository.dart';

class MembershipController extends ChangeNotifier {
  MembershipController(this.repository, this.session, this.client) {
    load();
  }
  final MembershipRepository repository;
  final SessionController session;
  final ApiClient client;
  List<MembershipPlan> plans = [];
  String? selected, error, successMessage;
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
    successMessage = null;
    notifyListeners();
    try {
      final user = await repository.activateTestSubscription(selected!);
      session.replaceUser(user);
      successMessage = 'Payment successful. Premium subscription enabled.';
      activationCount++;
    } catch (e) {
      error = client.errorMessage(e);
    } finally {
      paying = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    super.dispose();
  }
}
