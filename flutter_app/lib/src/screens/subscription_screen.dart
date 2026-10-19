import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../theme.dart';

class SubscriptionScreen extends ConsumerWidget {
  const SubscriptionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(subscriptionPurchaseControllerProvider);
    final session = ref.watch(sessionControllerProvider);
    final active = session.user?.subscriptionActive == true;
    return Scaffold(
      appBar: AppBar(title: const Text('HappiNotes Premium')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Icon(Icons.workspace_premium_rounded, size: 64, color: AppColors.coral),
            const SizedBox(height: 18),
            Text('Unlock every premium story', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 10),
            const Text('Choose a monthly or yearly subscription. One subscription unlocks all premium storybooks.', textAlign: TextAlign.center),
            const SizedBox(height: 24),
            if (controller.loading)
              const Center(child: CircularProgressIndicator())
            else if (active)
              _ActiveSubscription(plan: session.user?.subscriptionPlan, expiresAt: session.user?.subscriptionExpiresAt)
            else if (controller.plans.isEmpty)
              const Text('Subscription plans are not available yet.', textAlign: TextAlign.center)
            else
              ...controller.plans.map((plan) {
                final product = controller.productFor(plan.key);
                return Card(
                  margin: const EdgeInsets.only(bottom: 14),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(plan.key == 'monthly' ? 'Monthly' : 'Yearly', style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 4),
                            Text(
                              product?.price ?? _backendPrice(plan.priceInr),
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.coral),
                            ),
                          ]),
                        ),
                        FilledButton(
                          onPressed: product == null || controller.busy || controller.pendingFor(plan.key) ? null : () => controller.buy(plan.key),
                          child: Text(controller.pendingFor(plan.key) ? 'Waiting…' : 'Subscribe'),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            if (controller.message != null)
              Padding(padding: const EdgeInsets.only(top: 12), child: Text(controller.message!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.redAccent))),
            const SizedBox(height: 12),
            TextButton(onPressed: controller.busy || controller.loading ? null : controller.restore, child: const Text('Restore subscription')),
          ],
        ),
      ),
    );
  }
}

String _backendPrice(double priceInr) {
  if (priceInr <= 0) return 'Price unavailable';
  final value = priceInr == priceInr.roundToDouble()
      ? priceInr.toStringAsFixed(0)
      : priceInr.toStringAsFixed(2);
  return '₹$value';
}

class _ActiveSubscription extends StatelessWidget {
  const _ActiveSubscription({this.plan, this.expiresAt});
  final String? plan;
  final DateTime? expiresAt;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.green.withValues(alpha: .1), borderRadius: BorderRadius.circular(14)),
    child: Text(
      'Your ${plan == 'yearly' ? 'yearly' : 'monthly'} subscription is active${expiresAt == null ? '.' : ' until ${expiresAt!.toLocal().toString().split(' ').first}.'}',
      textAlign: TextAlign.center,
      style: const TextStyle(fontWeight: FontWeight.w700),
    ),
  );
}
