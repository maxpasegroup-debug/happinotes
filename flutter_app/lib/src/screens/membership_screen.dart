import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../theme.dart';
import '../widgets/app_message.dart';

class MembershipScreen extends ConsumerWidget {
  const MembershipScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(membershipControllerProvider);
    ref.listen<int>(
      membershipControllerProvider.select((value) => value.activationCount),
      (previous, next) {
        if (next > (previous ?? 0)) {
          AppMessage.show(context, 'Premium activated');
          Navigator.pop(context);
        }
      },
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Membership')),
      body: state.loading
          ? const Center(child: CircularProgressIndicator())
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
                  return Card(
                    color: active ? const Color(0xFF3A201C) : AppColors.surface,
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
                FilledButton(
                  onPressed: state.paying
                      ? null
                      : () => ref.read(membershipControllerProvider).pay(),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.coral,
                    padding: const EdgeInsets.all(17),
                  ),
                  child: Text(
                    state.paying
                        ? 'Opening checkout...'
                        : 'Continue to payment',
                  ),
                ),
              ],
            ),
    );
  }
}
