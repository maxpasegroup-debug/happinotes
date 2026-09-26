class User {
  const User({
    required this.id,
    required this.name,
    required this.role,
    this.phoneNumber,
    this.purchasedBookIds = const [],
    this.languagePreference = 'all',
  });
  final String id, name, role, languagePreference;
  final String? phoneNumber;
  final List<String> purchasedBookIds;
  User copyWith({String? languagePreference, List<String>? purchasedBookIds}) =>
      User(
        id: id,
        name: name,
        role: role,
        phoneNumber: phoneNumber,
        languagePreference: languagePreference ?? this.languagePreference,
        purchasedBookIds: purchasedBookIds ?? this.purchasedBookIds,
      );
}
