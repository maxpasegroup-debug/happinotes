import 'dart:convert';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../features/auth/domain/entities/account_deletion.dart';
import '../theme.dart';
import '../widgets/app_message.dart';

class AccountDeletionScreen extends ConsumerStatefulWidget {
  const AccountDeletionScreen({super.key});

  @override
  ConsumerState<AccountDeletionScreen> createState() =>
      _AccountDeletionScreenState();
}

class _AccountDeletionScreenState extends ConsumerState<AccountDeletionScreen> {
  AccountDeletionRequestStatus? _status;
  String? _error;
  String? _proof;
  String? _idempotencyKey;
  bool _checkingStatus = true;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadStatus());
  }

  Future<void> _loadStatus() async {
    if (!mounted) return;
    setState(() {
      _checkingStatus = true;
      _error = null;
    });
    try {
      final status = await ref
          .read(sessionControllerProvider)
          .getAccountDeletionStatus();
      if (!mounted) return;
      setState(() => _status = status);
      await _handleCompleted(status);
    } catch (error) {
      if (!mounted) return;
      if (_isDeletionNotFound(error)) {
        setState(() => _status = null);
      } else if (_isSessionExpired(error)) {
        await _expireSession();
      } else {
        setState(() => _error = _errorMessage(error));
      }
    } finally {
      if (mounted) setState(() => _checkingStatus = false);
    }
  }

  Future<void> _startDeletion() async {
    if (_loading || _status?.isPending == true) return;
    final confirmed = await _showConsequencesDialog();
    if (!confirmed || !mounted) return;

    final credential = await _showReauthenticationDialog();
    if (credential == null || !mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final proof = await ref
          .read(sessionControllerProvider)
          .requestDeletionReauth(credential);
      // The proof is kept only in this widget's memory long enough to submit
      // the one-time request. It is never persisted or logged.
      _proof = proof.proof;
      _idempotencyKey ??= _newIdempotencyKey();
      if (!mounted) return;
      final finalConfirmed = await _showFinalConfirmationDialog();
      if (!finalConfirmed || !mounted) {
        _proof = null;
        _idempotencyKey = null;
        return;
      }
      await _submitRequest();
    } catch (error) {
      if (!mounted) return;
      if (_isSessionExpired(error)) {
        await _expireSession();
      } else if (_error == null) {
        setState(() => _error = _errorMessage(error));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitRequest() async {
    final proof = _proof;
    final idempotencyKey = _idempotencyKey;
    if (proof == null || idempotencyKey == null) return;
    try {
      final status = await ref
          .read(sessionControllerProvider)
          .requestAccountDeletion(proof: proof, idempotencyKey: idempotencyKey);
      _proof = null;
      if (!mounted) return;
      setState(() {
        _status = status;
        _error = null;
      });
      await _handleCompleted(status);
    } catch (error) {
      if (!mounted) return;
      if (_isSessionExpired(error)) {
        await _expireSession();
      } else {
        setState(() {
          _error =
              '${_errorMessage(error)} If the request was accepted, use Check status before trying again.';
        });
      }
      rethrow;
    }
  }

  Future<void> _retryRequest() async {
    if (_loading || _proof == null || _idempotencyKey == null) {
      await _loadStatus();
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _submitRequest();
    } catch (_) {
      // _submitRequest has already converted the error into safe UI text.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleCompleted(AccountDeletionRequestStatus status) async {
    if (status.status != AccountDeletionStatus.completed || !mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Account deletion completed'),
        content: Text(
          'The backend confirmed that the deletion workflow completed. Save this reference for support: ${status.reference ?? 'not available'}. The app will sign you out, so you will no longer be able to check status here.',
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    await ref.read(sessionControllerProvider).logout();
    if (!mounted) return;
    AppMessage.showGlobal('Your HappiNotes account deletion is complete.');
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  Future<void> _expireSession() async {
    await ref.read(sessionControllerProvider).logout();
    if (!mounted) return;
    AppMessage.showGlobal('Your session expired. Please sign in again.');
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  Future<bool> _showConsequencesDialog() async =>
      await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Delete your account?'),
          content: const SingleChildScrollView(
            child: Text(
              'This request blocks access to your account. Current processing removes authentication data, anonymises ordinary profile fields, removes email and phone, clears saved preferences and device tokens, and revokes HappiNotes Premium and purchased-book access. Purchase and subscription evidence, provider records, support records, logs, backups and minimal deletion history still require approved handling, so deletion may pause before completion.\n\n'
              'Deleting your HappiNotes account does not cancel a Google Play or App Store subscription. Manage or cancel that subscription in the store before continuing if needed.',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Keep account'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.red.shade700,
              ),
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Continue'),
            ),
          ],
        ),
      ) ??
      false;

  Future<String?> _showReauthenticationDialog() => showDialog<String>(
    context: context,
    builder: (_) => const _ReauthenticationDialog(),
  );

  Future<bool> _showFinalConfirmationDialog() async =>
      await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Final confirmation'),
          content: const Text(
            'Send the account-deletion request now? This cannot be undone once processing begins. Your store subscription is separate and will not be cancelled by this request.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.red.shade700,
              ),
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Delete account'),
            ),
          ],
        ),
      ) ??
      false;

  String _newIdempotencyKey() {
    final random = Random.secure();
    final bytes = List<int>.generate(24, (_) => random.nextInt(256));
    return base64UrlEncode(bytes);
  }

  String _errorMessage(Object error) =>
      ref.read(apiClientProvider).errorMessage(error);

  bool _isSessionExpired(Object error) {
    if (error is! DioException || error.response?.statusCode != 401) {
      return false;
    }
    final data = error.response?.data;
    final message = data is Map ? (data['message'] ?? '').toString() : '';
    return message.contains('Invalid or expired token') ||
        message.contains('User not found') ||
        message.contains('Account deletion is no longer available');
  }

  bool _isDeletionNotFound(Object error) {
    if (error is! DioException || error.response?.statusCode != 401) {
      return false;
    }
    final data = error.response?.data;
    return data is Map &&
        (data['message'] ?? '').toString() == 'Deletion request not found';
  }

  String _statusTitle(AccountDeletionStatus status) => switch (status) {
    AccountDeletionStatus.requested => 'Deletion request received',
    AccountDeletionStatus.processing => 'Deletion is processing',
    AccountDeletionStatus.failedRetryable => 'Deletion will retry',
    AccountDeletionStatus.failedManual => 'Deletion needs support',
    AccountDeletionStatus.blockedPolicy => 'Deletion is temporarily paused',
    AccountDeletionStatus.completed => 'Account deleted',
    AccountDeletionStatus.unknown => 'Deletion status unavailable',
  };

  String _statusBody(AccountDeletionStatus status) => switch (status) {
    AccountDeletionStatus.requested =>
      'Your request was received and account access is blocked. This does not mean deletion is complete. You can refresh status without creating another request.',
    AccountDeletionStatus.processing =>
      'Processing removes your password, OTPs, reset and reauthentication tokens; replaces your profile name with a generic label; removes your email and phone; resets profile settings; and clears favourites, collections, push-token references, purchased-book access and HappiNotes Premium access. Your store purchase and subscription transaction records, support records, provider data, logs, backups and deletion audit handling are still awaiting policy decisions. The request will pause at the policy gate and is not complete. Google Play and Apple subscriptions are not cancelled automatically; manage or cancel them in the relevant store.',
    AccountDeletionStatus.failedRetryable =>
      'A temporary problem interrupted processing. The backend can retry safely. Check the status again shortly.',
    AccountDeletionStatus.failedManual =>
      'The request needs support review. Your account remains protected and has not been reported as deleted.',
    AccountDeletionStatus.blockedPolicy =>
      'Processing is paused until the required retention and purchase/entitlement decisions are approved and implemented. Your account remains protected; this is not a completed deletion.',
    AccountDeletionStatus.completed =>
      'The backend reports that account deletion is complete.',
    AccountDeletionStatus.unknown =>
      'The backend returned an unrecognized state. Do not submit another request; contact support.',
  };

  @override
  Widget build(BuildContext context) {
    final status = _status;
    final hasPending = status?.isPending == true;
    final canRetryRequest = _proof != null && _idempotencyKey != null;
    return Scaffold(
      appBar: AppBar(title: const Text('Delete account')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            Icon(
              Icons.delete_forever_outlined,
              size: 64,
              color: Colors.red.shade700,
            ),
            const SizedBox(height: 16),
            Text(
              'Account deletion',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: Colors.red.shade700),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 10),
            if (_checkingStatus)
              const Center(child: CircularProgressIndicator())
            else if (status != null)
              _StatusCard(
                title: _statusTitle(status.status),
                body: _statusBody(status.status),
                status: status.status,
                reference: status.reference,
                onRefresh: _loading ? null : _loadStatus,
              )
            else
              FilledButton.icon(
                onPressed: _loading
                    ? null
                    : canRetryRequest
                    ? _retryRequest
                    : _startDeletion,
                icon: _loading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.delete_outline),
                label: Text(
                  _loading
                      ? 'Working…'
                      : canRetryRequest
                      ? 'Retry deletion request'
                      : 'Start account deletion',
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.red.shade700,
                ),
              ),
            if (status?.reference != null && status?.statusToken != null) ...[
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Save your status details',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Use these details on the public account-deletion page if this app session ends. Keep the status code private. It cannot be reissued after your contact details are erased.',
                      ),
                      const SizedBox(height: 8),
                      const Text('Request reference'),
                      SelectableText(status!.reference!),
                      const SizedBox(height: 8),
                      const Text('Private status code'),
                      SelectableText(status.statusToken!),
                    ],
                  ),
                ),
              ),
            ],
            if (hasPending &&
                status?.status == AccountDeletionStatus.failedRetryable &&
                _proof != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: OutlinedButton(
                  onPressed: _loading ? null : _retryRequest,
                  child: const Text('Retry request'),
                ),
              ),
            const SizedBox(height: 20),
            const Text(
              'You will confirm your password or PIN before a request is sent. Save the reference and private status code shown after submission. Email-based recovery may stop once contact details are erased; phone-only external verification is not available.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Before you continue',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Account access, purchased-book access and HappiNotes Premium access are revoked during processing. Purchase and subscription records remain behind the policy gate, so the request may pause before completion.\nGoogle Play/App Store billing is separate; this action does not cancel it.\nCancel or manage billing in the relevant store.',
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            TextButton.icon(
              onPressed: _loading ? null : _loadStatus,
              icon: const Icon(Icons.refresh),
              label: const Text('Check status'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReauthenticationDialog extends StatefulWidget {
  const _ReauthenticationDialog();

  @override
  State<_ReauthenticationDialog> createState() =>
      _ReauthenticationDialogState();
}

class _ReauthenticationDialogState extends State<_ReauthenticationDialog> {
  late final TextEditingController _controller;
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext dialogContext) => AlertDialog(
    title: const Text('Confirm your identity'),
    content: TextField(
      controller: _controller,
      autofocus: true,
      obscureText: _obscure,
      autocorrect: false,
      enableSuggestions: false,
      onChanged: (_) => setState(() {}),
      textInputAction: TextInputAction.done,
      onSubmitted: (value) {
        if (value.length >= 6) Navigator.pop(dialogContext, value);
      },
      decoration: InputDecoration(
        labelText: 'Password or PIN',
        suffixIcon: IconButton(
          tooltip: _obscure ? 'Show credential' : 'Hide credential',
          icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(dialogContext),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: _controller.text.length < 6
            ? null
            : () => Navigator.pop(dialogContext, _controller.text),
        child: const Text('Verify'),
      ),
    ],
  );
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.title,
    required this.body,
    required this.status,
    required this.reference,
    required this.onRefresh,
  });

  final String title;
  final String body;
  final AccountDeletionStatus status;
  final String? reference;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    final isBlocked =
        status == AccountDeletionStatus.blockedPolicy ||
        status == AccountDeletionStatus.failedManual;
    final isWarning =
        isBlocked || status == AccountDeletionStatus.failedRetryable;
    return Card(
      color: isWarning
          ? Colors.orange.withValues(alpha: .12)
          : AppColors.success.withValues(alpha: .1),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isWarning ? Icons.info_outline : Icons.hourglass_top_rounded,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(body),
            if (reference != null && reference!.isNotEmpty) ...[
              const SizedBox(height: 10),
              SelectableText('Request reference: $reference'),
            ],
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh),
                label: const Text('Refresh status'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
