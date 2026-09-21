import '../../../../core/network/api_client.dart';
import '../../../auth/data/models/user_model.dart';
import '../../../auth/domain/entities/user.dart';
import '../../domain/entities/plan.dart';
import '../../domain/repositories/membership_repository.dart';

class MembershipRepositoryImpl implements MembershipRepository {
  MembershipRepositoryImpl(this.client);
  final ApiClient client;
  @override
  Future<List<MembershipPlan>> getPlans() async {
    final r = await client.dio.get('/payments/plans');
    return (r.data['plans'] as List? ?? []).map((x) {
      final p = Map<String, dynamic>.from(x);
      return MembershipPlan(
        id: p['id'].toString(),
        name: p['name'].toString(),
        price: (p['price'] as num).toInt(),
        durationDays: (p['durationDays'] as num).toInt(),
      );
    }).toList();
  }

  @override
  Future<Map<String, dynamic>> createOrder(String id) async {
    final r = await client.dio.post(
      '/payments/razorpay/create-order',
      data: {'plan': id},
    );
    return Map<String, dynamic>.from(r.data);
  }

  @override
  Future<User> activateTestSubscription(String id) async {
    final r = await client.dio.post('/payments/test/activate', data: {'plan': id});
    return UserModel.fromJson(Map<String, dynamic>.from(r.data['user']));
  }

  @override
  Future<User> verifyPayment({
    required String subscriptionId,
    required String paymentId,
    required String signature,
  }) async {
    final r = await client.dio.post(
      '/payments/razorpay/verify',
      data: {
        'razorpay_subscription_id': subscriptionId,
        'razorpay_payment_id': paymentId,
        'razorpay_signature': signature,
      },
    );
    return UserModel.fromJson(Map<String, dynamic>.from(r.data['user']));
  }
}
