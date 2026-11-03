import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../app/providers.dart';
import '../theme.dart';

class SubscriptionScreen extends ConsumerWidget {
  const SubscriptionScreen({super.key, this.showCloseButton = false});

  final bool showCloseButton;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(subscriptionPurchaseControllerProvider);
    final session = ref.watch(sessionControllerProvider);
    final user = session.user;
    final active = user?.subscriptionActive == true;
    final isAndroid = defaultTargetPlatform == TargetPlatform.android;
    final isIOS = defaultTargetPlatform == TargetPlatform.iOS;
    final storeName = isAndroid ? 'Google Play' : 'the App Store';
    final canManageInStore = isAndroid || isIOS;
    String? activeProductId = user?.subscriptionProductId;
    if (activeProductId == null) {
      for (final plan in controller.plans) {
        if (plan.key == user?.subscriptionPlan) {
          activeProductId = plan.productId;
          break;
        }
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('HappiNotes Premium'),
        automaticallyImplyLeading: !showCloseButton,
        leading: showCloseButton
            ? IconButton(
                tooltip: 'Close',
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              )
            : null,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Icon(
              Icons.workspace_premium_rounded,
              size: 64,
              color: AppColors.coral,
            ),
            const SizedBox(height: 18),
            Text(
              'Unlock every premium story',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            Text(
              'Your app store handles payment and subscription settings. You can manage or cancel in $storeName settings; if you cancel, Premium stays active until the paid period ends.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            if (controller.loading)
              const Center(child: CircularProgressIndicator())
            else if (active)
              _ActiveSubscription(
                plan: user?.subscriptionPlan,
                expiresAt: user?.subscriptionExpiresAt,
                autoRenewing: user?.subscriptionAutoRenewing,
                renewalPrice: controller.productById(activeProductId)?.price,
              )
            else if (controller.plans.isEmpty)
              const Text(
                'Subscription plans are not available yet.',
                textAlign: TextAlign.center,
              )
            else
              ...controller.plans.map((plan) {
                final product = controller.productFor(plan.key);
                final offer = controller.offerFor(plan.key);
                final frequency = plan.billingPeriod == 'P1Y'
                    ? 'year'
                    : 'month';
                final discount = offer == null
                    ? null
                    : ((offer.regularPrice - offer.offerPrice) /
                              offer.regularPrice *
                              100)
                          .toStringAsFixed(2);
                return Card(
                  margin: const EdgeInsets.only(bottom: 14),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          plan.key == 'monthly' ? 'Monthly' : 'Yearly',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          product?.price ?? 'Price unavailable in this store',
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(
                                color: product == null
                                    ? AppColors.muted
                                    : AppColors.coral,
                              ),
                        ),
                        Text(
                          'per $frequency · billed by $storeName',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: AppColors.muted),
                        ),
                        if (product != null && offer != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Offer price. Regular price: ${offer.currencyCode} ${_formatAmount(offer.regularPrice)} ($discount% off).',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          Text(
                            'Renews at ${product.price} every $frequency. This offer rate continues for each renewal while your subscription stays active; it does not automatically change to the regular price.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ] else if (product != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Renews at ${product.price} every $frequency until you cancel.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                        if (product != null)
                          Text(
                            'The store shows your final localized checkout price. Manage or cancel anytime in $storeName settings; Premium stays active through the paid period.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.muted),
                          ),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerRight,
                          child: FilledButton(
                            onPressed:
                                product == null ||
                                    controller.busy ||
                                    controller.pendingFor(plan.key)
                                ? null
                                : () => controller.buy(plan.key),
                            child: Text(
                              controller.pendingFor(plan.key)
                                  ? 'Waiting…'
                                  : 'Subscribe',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            if (controller.message != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  controller.message!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.redAccent),
                ),
              ),
            const SizedBox(height: 12),
            if (canManageInStore)
              TextButton.icon(
                onPressed: () => _openStoreSubscriptions(
                  context,
                  isAndroid,
                  activeProductId,
                ),
                icon: const Icon(Icons.open_in_new_rounded),
                label: Text('Manage or cancel in $storeName'),
              ),
            TextButton(
              onPressed: controller.busy || controller.loading
                  ? null
                  : controller.restore,
              child: const Text('Restore subscription'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveSubscription extends StatelessWidget {
  const _ActiveSubscription({
    this.plan,
    this.expiresAt,
    this.autoRenewing,
    this.renewalPrice,
  });

  final String? plan;
  final DateTime? expiresAt;
  final bool? autoRenewing;
  final String? renewalPrice;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.green.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Text(
      autoRenewing == false
          ? 'Auto-renew is off. Premium access continues until ${expiresAt?.toLocal().toString().split(' ').first ?? 'the current period ends'}. You will not be charged again unless you subscribe again.'
          : autoRenewing == true
          ? 'Auto-renew is on. Your ${plan == 'yearly' ? 'yearly' : 'monthly'} subscription renews at ${renewalPrice ?? 'the amount shown in your app store settings'} each ${plan == 'yearly' ? 'year' : 'month'}${expiresAt == null ? '.' : ' and is active until ${expiresAt!.toLocal().toString().split(' ').first}.'} Manage or cancel it in your app store settings.'
          : 'Your ${plan == 'yearly' ? 'yearly' : 'monthly'} subscription is active${expiresAt == null ? '.' : ' until ${expiresAt!.toLocal().toString().split(' ').first}.'} Check your app store settings for renewal details.',
      textAlign: TextAlign.center,
      style: const TextStyle(fontWeight: FontWeight.w700),
    ),
  );
}

String _formatAmount(double amount) => amount == amount.roundToDouble()
    ? amount.toStringAsFixed(0)
    : amount.toStringAsFixed(2);

Future<void> _openStoreSubscriptions(
  BuildContext context,
  bool isAndroid,
  String? productId,
) async {
  final uri = isAndroid
      ? Uri.https('play.google.com', '/store/account/subscriptions', {
          'package': 'com.happinotes.happinotes_flutter',
          if (productId != null) 'sku': productId,
        })
      : Uri.parse('https://apps.apple.com/account/subscriptions');
  try {
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open your app store subscription settings.'),
        ),
      );
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open your app store subscription settings.'),
        ),
      );
    }
  }
}
