import '../../domain/entities/user.dart';

class UserModel extends User {
  const UserModel({
    required super.id,
    required super.name,
    required super.role,
    super.phoneNumber,
    super.subscriptionStatus,
    super.subscriptionExpiry,
    super.subscriptionPlan,
    super.languagePreference,
  });
  factory UserModel.fromJson(Map<String, dynamic> json) {
    final expiryRaw = json['subscriptionExpiry'];
    final expiry = expiryRaw == null ? null : DateTime.tryParse(expiryRaw.toString());
    final active = json['subscriptionActive'] == true && (expiry == null || expiry.isAfter(DateTime.now()));
    return UserModel(
    id: (json['id'] ?? json['_id'] ?? '').toString(),
    name: (json['name'] ?? '').toString(),
    role: (json['role'] ?? 'user').toString(),
    phoneNumber: json['phoneNumber']?.toString(),
    subscriptionStatus: active ? 'premium' : 'free',
    languagePreference: (json['languagePreference'] ?? 'all').toString(),
    subscriptionExpiry: expiry,
    subscriptionPlan: json['subscriptionPlan']?.toString(),
    );
  }
}
