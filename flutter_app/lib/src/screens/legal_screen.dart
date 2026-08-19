import 'package:flutter/material.dart';
import '../theme.dart';

class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Legal')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        LegalSection(
          title: 'Privacy Policy',
          body:
              'HappiNotes stores the account information and listening activity required to provide the service. Authentication credentials are protected, and payment card details are handled by the payment provider rather than stored in the app.',
        ),
        LegalSection(
          title: 'Terms & Conditions',
          body:
              'Use HappiNotes only for lawful personal listening. Premium access belongs to the registered account. Content may not be copied, redistributed, or used outside the permissions provided by HappiNotes.',
        ),
        LegalSection(
          title: 'Refund Policy',
          body:
              'Subscription and payment refund requests are reviewed according to applicable law and the payment provider rules. Contact HappiNotes support with the payment reference and registered phone number.',
        ),
        SizedBox(height: 24),
        Text(
          'These policies should be reviewed by a qualified legal professional before a production release.',
          style: TextStyle(color: AppColors.muted, fontSize: 12),
        ),
      ],
    ),
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
