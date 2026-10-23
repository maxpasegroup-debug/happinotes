import '../../domain/entities/user.dart';

class UserModel extends User {
  const UserModel({
    required super.id,
    required super.name,
    required super.role,
    super.email,
    super.phoneNumber,
    super.purchasedBookIds,
    super.languagePreference,
    super.subscriptionActive,
    super.subscriptionPlan,
    super.subscriptionExpiresAt,
  });
  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rawExpiry =
        json['subscriptionExpiresAt'] ??
        (json['subscription'] is Map
            ? (json['subscription'] as Map)['expiresAt']
            : null);
    return UserModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      role: (json['role'] ?? 'user').toString(),
      email: json['email']?.toString(),
      phoneNumber: json['phoneNumber']?.toString(),
      languagePreference: (json['languagePreference'] ?? 'all').toString(),
      purchasedBookIds: (json['purchasedBookIds'] as List? ?? const [])
          .map((e) => e.toString())
          .toList(),
      subscriptionActive:
          json['subscriptionActive'] == true ||
          (json['subscription'] is Map &&
              (json['subscription'] as Map)['active'] == true),
      subscriptionPlan:
          (json['subscriptionPlan'] ??
                  (json['subscription'] is Map
                      ? (json['subscription'] as Map)['planKey']
                      : null))
              ?.toString(),
      subscriptionExpiresAt: rawExpiry == null
          ? null
          : DateTime.tryParse(rawExpiry.toString()),
    );
  }
}
