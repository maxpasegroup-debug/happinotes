import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../theme.dart';
import '../widgets/loading_skeleton.dart';
import 'membership_checkout_screen.dart';

class MembershipScreen extends ConsumerWidget {
  const MembershipScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(membershipControllerProvider);
    final user = ref.watch(sessionControllerProvider).user;
    final isPremium = user?.hasActiveSubscription ?? false;
    final matches = state.plans.where((p) => p.id == state.selected);
    final selectedPlan = matches.isEmpty ? null : matches.first;
    return Scaffold(
      appBar: AppBar(title: const Text('Membership plans'), leading: IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.of(context).pop())),
      body: state.loading
          ? const DashboardLoadingSkeleton()
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(isPremium ? 'Premium active' : 'Go Premium', style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900)),
                const SizedBox(height: 8),
                Text(isPremium ? 'Your premium subscription is active.' : 'Unlock every premium audiobook.', style: const TextStyle(color: AppColors.muted)),
                if (isPremium) ...[
                  const SizedBox(height: 16),
                  _StatusCard(),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(14)),
                    child: Row(children: [
                      const Icon(Icons.receipt_long_rounded),
                      const SizedBox(width: 10),
                      Expanded(child: Text('Subscription plan: ${_planName(user?.subscriptionPlan)}', style: const TextStyle(fontWeight: FontWeight.w800))),
                    ]),
                  ),
                  if (user?.subscriptionExpiry != null) ...[
                    const SizedBox(height: 8),
                    Text('Expires on ${_date(user!.subscriptionExpiry!)}', style: const TextStyle(color: AppColors.muted)),
                  ],
                ],
                const SizedBox(height: 24),
                if (!isPremium && selectedPlan != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                    decoration: BoxDecoration(color: AppColors.coral.withValues(alpha: .12), borderRadius: BorderRadius.circular(12)),
                    child: Text('Selected plan: ${selectedPlan.name}', style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                if (!isPremium) ...state.plans.map((plan) {
                  final active = state.selected == plan.id;
                  final scheme = Theme.of(context).colorScheme;
                  return Card(
                    color: active ? Color.alphaBlend(AppColors.coral.withValues(alpha: .14), scheme.surface) : scheme.surface,
                    shape: RoundedRectangleBorder(side: BorderSide(color: active ? AppColors.coral : Colors.transparent, width: 2), borderRadius: BorderRadius.circular(16)),
                    child: ListTile(
                      onTap: () => ref.read(membershipControllerProvider).select(plan.id),
                      leading: Icon(active ? Icons.radio_button_checked : Icons.radio_button_off, color: active ? AppColors.coral : AppColors.muted),
                      title: Text(plan.name, style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text('${plan.durationDays} days'),
                      trailing: Text('INR ${plan.price}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                    ),
                  );
                }),
                if (state.error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(state.error!, style: const TextStyle(color: Colors.redAccent))),
                if (!isPremium)
                  FilledButton(
                    onPressed: state.selected == null ? null : () {
                      final selected = state.plans.firstWhere((p) => p.id == state.selected);
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => MembershipCheckoutScreen(plan: selected)));
                    },
                    style: FilledButton.styleFrom(backgroundColor: AppColors.coral, padding: const EdgeInsets.all(17)),
                    child: const Text('Continue'),
                  ),
              ],
            ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: const Color(0xFF21894A).withValues(alpha: .14), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF21894A))),
    child: const Row(children: [Icon(Icons.verified_rounded, color: Color(0xFF21894A)), SizedBox(width: 10), Expanded(child: Text('Premium subscription enabled', style: TextStyle(fontWeight: FontWeight.w700)))]),
  );
}

String _date(DateTime value) {
  final date = value.toLocal();
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
}

String _planName(String? plan) {
  switch (plan?.toLowerCase()) {
    case 'monthly': return 'Monthly';
    case 'yearly': return 'Yearly';
    default: return 'Plan not available';
  }
}
