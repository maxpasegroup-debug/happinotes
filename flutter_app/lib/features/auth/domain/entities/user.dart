class User {
  const User({
    required this.id,
    required this.name,
    required this.role,
    this.email,
    this.phoneNumber,
    this.purchasedBookIds = const [],
    this.languagePreference = 'all',
    this.subscriptionActive = false,
    this.subscriptionPlan,
    this.subscriptionExpiresAt,
  });
  final String id, name, role, languagePreference;
  final String? email;
  final String? phoneNumber;
  final List<String> purchasedBookIds;
  final bool subscriptionActive;
  final String? subscriptionPlan;
  final DateTime? subscriptionExpiresAt;
  User copyWith({
    String? languagePreference,
    List<String>? purchasedBookIds,
    bool? subscriptionActive,
    String? subscriptionPlan,
    DateTime? subscriptionExpiresAt,
  }) => User(
    id: id,
    name: name,
    role: role,
    email: email,
    phoneNumber: phoneNumber,
    languagePreference: languagePreference ?? this.languagePreference,
    purchasedBookIds: purchasedBookIds ?? this.purchasedBookIds,
    subscriptionActive: subscriptionActive ?? this.subscriptionActive,
    subscriptionPlan: subscriptionPlan ?? this.subscriptionPlan,
    subscriptionExpiresAt: subscriptionExpiresAt ?? this.subscriptionExpiresAt,
  );
}
