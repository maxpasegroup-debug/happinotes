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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Membership plans'),
        leading: IconButton(
          tooltip: 'Close',
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: state.loading
          ? const DashboardLoadingSkeleton()
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Text(
                  'Go Premium',
                  style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Unlock every premium audiobook.',
                  style: TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 24),
                ...state.plans.map((plan) {
                  final active = state.selected == plan.id;
                  final scheme = Theme.of(context).colorScheme;
                  return Card(
                    color: active
                        ? Color.alphaBlend(
                            AppColors.coral.withValues(alpha: .14),
                            scheme.surface,
                          )
                        : scheme.surface,
                    shape: RoundedRectangleBorder(
                      side: BorderSide(
                        color: active ? AppColors.coral : Colors.transparent,
                        width: 2,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: ListTile(
                      onTap: () => ref
                          .read(membershipControllerProvider)
                          .select(plan.id),
                      leading: Icon(
                        active
                            ? Icons.radio_button_checked
                            : Icons.radio_button_off,
                        color: active ? AppColors.coral : AppColors.muted,
                      ),
                      title: Text(
                        plan.name,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text('${plan.durationDays} days'),
                      trailing: Text(
                        'INR ${plan.price}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  );
                }),
                if (state.error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      state.error!,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                  ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: state.selected == null
                      ? null
                      : () {
                          final selectedPlan = state.plans.firstWhere(
                            (plan) => plan.id == state.selected,
                          );
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => MembershipCheckoutScreen(
                                plan: selectedPlan,
                              ),
                            ),
                          );
                        },
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.coral,
                    padding: const EdgeInsets.all(17),
                  ),
                  child: const Text('Continue'),
                ),
              ],
            ),
    );
  }
}
