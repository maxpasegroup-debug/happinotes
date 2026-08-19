import '../../../auth/domain/entities/user.dart';
import '../entities/plan.dart';

abstract interface class MembershipRepository {
  Future<List<MembershipPlan>> getPlans();
  Future<Map<String, dynamic>> createOrder(String planId);
  Future<User> verifyPayment({
    required String orderId,
    required String paymentId,
    required String signature,
  });
}
