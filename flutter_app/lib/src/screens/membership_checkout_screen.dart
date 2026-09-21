import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../features/membership/domain/entities/plan.dart';
import '../theme.dart';
import '../widgets/app_message.dart';

class MembershipCheckoutScreen extends ConsumerWidget {
  const MembershipCheckoutScreen({super.key, required this.plan});

  final MembershipPlan plan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(membershipControllerProvider);
    ref.listen<int>(
      membershipControllerProvider.select((value) => value.activationCount),
      (previous, next) {
        if (next > (previous ?? 0) && context.mounted) {
          AppMessage.show(context, 'Payment successful. Premium activated.');
          Navigator.of(context).pop();
        }
      },
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Confirm membership')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.card_membership_rounded, size: 72, color: AppColors.coral),
              const SizedBox(height: 20),
              Text(plan.name, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text('${plan.durationDays} days of premium access', textAlign: TextAlign.center),
              const SizedBox(height: 20),
              Text('INR ${plan.price}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900)),
              const SizedBox(height: 12),
              const Text('This test payment activates premium access for the selected period. Your account becomes premium after the backend confirms activation.', textAlign: TextAlign.center),
              const Spacer(),
              if (state.error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(state.error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.redAccent)),
                ),
              FilledButton(
                onPressed: state.paying ? null : () => ref.read(membershipControllerProvider).pay(),
                style: FilledButton.styleFrom(backgroundColor: AppColors.coral, padding: const EdgeInsets.all(17)),
                child: Text(state.paying ? 'Activating...' : 'Proceed to payment'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: state.paying ? null : () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
