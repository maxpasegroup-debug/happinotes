class User {
  const User({
    required this.id,
    required this.name,
    required this.role,
    this.phoneNumber,
    this.subscriptionStatus = 'free',
    this.languagePreference = 'all',
  });
  final String id, name, role, subscriptionStatus, languagePreference;
  final String? phoneNumber;
  User copyWith({String? subscriptionStatus, String? languagePreference}) =>
      User(
        id: id,
        name: name,
        role: role,
        phoneNumber: phoneNumber,
        subscriptionStatus: subscriptionStatus ?? this.subscriptionStatus,
        languagePreference: languagePreference ?? this.languagePreference,
      );
}
