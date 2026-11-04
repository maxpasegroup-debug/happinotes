import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme.dart';

const _policyBaseUrl = 'https://happinotes.online';

class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Legal')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'HappiNotes is owned and operated by AIRASKILL CITY PRIVATE LIMITED.\nRegistered office: 2619, T2, 6th Floor, HiLITE Business Park, HiLITE City, near Guruvayurappan College, Kozhikode – 673014, Kerala, India.\nCustomer support and privacy: hello@happinotes.online · +91 8089239823',
          style: TextStyle(color: AppColors.muted, fontSize: 13, height: 1.5),
        ),
        const SizedBox(height: 10),
        const Text(
          'These policy pages are drafts awaiting owner and legal review. Do not treat them as final terms until the published versions are approved.',
          style: TextStyle(color: AppColors.muted, fontSize: 13, height: 1.5),
        ),
        const SizedBox(height: 20),
        _LegalLink(title: 'Privacy Policy', path: '/privacy-policy', icon: Icons.privacy_tip_outlined),
        _LegalLink(title: 'Terms and Conditions', path: '/terms', icon: Icons.description_outlined),
        _LegalLink(title: 'Subscription, Cancellation and Refund', path: '/subscription-policy', icon: Icons.autorenew),
        _LegalLink(title: 'Refund Policy', path: '/refund-policy', icon: Icons.receipt_long_outlined),
        _LegalLink(title: 'Cookies and Similar Technologies', path: '/cookie-policy', icon: Icons.cookie_outlined),
        _LegalLink(title: 'Acceptable Use', path: '/acceptable-use', icon: Icons.rule_outlined),
        _LegalLink(title: 'Content and Copyright Complaints', path: '/content-policy', icon: Icons.copyright_outlined),
        _LegalLink(title: 'Grievance and Privacy Complaints', path: '/grievance-redressal', icon: Icons.support_agent_outlined),
        _LegalLink(title: 'Account Deletion', path: '/account-deletion', icon: Icons.delete_outline),
      ],
    ),
  );
}

class _LegalLink extends StatelessWidget {
  const _LegalLink({required this.title, required this.path, required this.icon});
  final String title;
  final String path;
  final IconData icon;

  Future<void> _open(BuildContext context) async {
    final uri = Uri.parse('$_policyBaseUrl$path');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open this policy page.')));
    }
  }

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(icon, color: AppColors.muted),
    title: Text(title),
    trailing: const Icon(Icons.open_in_new, size: 18),
    onTap: () => _open(context),
  );
}

class LegalSection extends StatelessWidget {
  const LegalSection({super.key, required this.title, required this.body});
  final String title, body;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 26),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 10),
        Text(
          body,
          style: const TextStyle(color: AppColors.muted, height: 1.55),
        ),
      ],
    ),
  );
}
