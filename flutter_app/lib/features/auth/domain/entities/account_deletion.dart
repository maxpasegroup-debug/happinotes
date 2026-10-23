enum AccountDeletionStatus {
  requested,
  processing,
  failedRetryable,
  failedManual,
  blockedPolicy,
  completed,
  unknown,
}

AccountDeletionStatus accountDeletionStatusFromJson(Object? value) {
  switch (value?.toString()) {
    case 'requested':
      return AccountDeletionStatus.requested;
    case 'processing':
      return AccountDeletionStatus.processing;
    case 'failed_retryable':
      return AccountDeletionStatus.failedRetryable;
    case 'failed_manual':
      return AccountDeletionStatus.failedManual;
    case 'blocked_policy':
      return AccountDeletionStatus.blockedPolicy;
    case 'completed':
      return AccountDeletionStatus.completed;
    default:
      return AccountDeletionStatus.unknown;
  }
}

class DeletionReauthProof {
  const DeletionReauthProof({required this.proof, this.expiresAt});

  final String proof;
  final DateTime? expiresAt;
}

class AccountDeletionRequestStatus {
  const AccountDeletionRequestStatus({
    required this.requestId,
    required this.status,
    this.requestedAt,
    this.startedAt,
    this.completedAt,
    this.failureCode,
  });

  factory AccountDeletionRequestStatus.fromJson(Map<String, dynamic> json) {
    DateTime? date(Object? value) =>
        value == null ? null : DateTime.tryParse(value.toString());
    return AccountDeletionRequestStatus(
      requestId: (json['requestId'] ?? '').toString(),
      status: accountDeletionStatusFromJson(json['status']),
      requestedAt: date(json['requestedAt']),
      startedAt: date(json['startedAt']),
      completedAt: date(json['completedAt']),
      failureCode: json['failureCode']?.toString(),
    );
  }

  final String requestId;
  final AccountDeletionStatus status;
  final DateTime? requestedAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final String? failureCode;

  bool get isPending => switch (status) {
    AccountDeletionStatus.requested ||
    AccountDeletionStatus.processing ||
    AccountDeletionStatus.failedRetryable ||
    AccountDeletionStatus.blockedPolicy ||
    AccountDeletionStatus.failedManual => true,
    _ => false,
  };
}
