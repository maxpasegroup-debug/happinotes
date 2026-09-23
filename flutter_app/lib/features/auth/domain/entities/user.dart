class User {
  const User({
    required this.id,
    required this.name,
    required this.role,
    this.phoneNumber,
    this.subscriptionStatus = 'free',
    this.subscriptionExpiry,
    this.subscriptionPlan,
    this.purchasedBookIds = const [],
    this.languagePreference = 'all',
  });
  final String id, name, role, subscriptionStatus, languagePreference;
  final String? phoneNumber;
  final DateTime? subscriptionExpiry;
  final String? subscriptionPlan;
  final List<String> purchasedBookIds;
  bool get hasActiveSubscription =>
      subscriptionStatus == 'premium' &&
      (subscriptionExpiry == null || subscriptionExpiry!.isAfter(DateTime.now()));
  User copyWith({String? subscriptionStatus, String? languagePreference, DateTime? subscriptionExpiry, String? subscriptionPlan, List<String>? purchasedBookIds}) =>
      User(
        id: id,
        name: name,
        role: role,
        phoneNumber: phoneNumber,
        subscriptionStatus: subscriptionStatus ?? this.subscriptionStatus,
        languagePreference: languagePreference ?? this.languagePreference,
        subscriptionExpiry: subscriptionExpiry ?? this.subscriptionExpiry,
        subscriptionPlan: subscriptionPlan ?? this.subscriptionPlan,
        purchasedBookIds: purchasedBookIds ?? this.purchasedBookIds,
      );
}
