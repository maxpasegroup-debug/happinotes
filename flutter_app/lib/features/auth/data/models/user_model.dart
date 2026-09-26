import '../../domain/entities/user.dart';

class UserModel extends User {
  const UserModel({
    required super.id,
    required super.name,
    required super.role,
    super.phoneNumber,
    super.purchasedBookIds,
    super.languagePreference,
  });
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
    id: (json['id'] ?? json['_id'] ?? '').toString(),
    name: (json['name'] ?? '').toString(),
    role: (json['role'] ?? 'user').toString(),
    phoneNumber: json['phoneNumber']?.toString(),
    languagePreference: (json['languagePreference'] ?? 'all').toString(),
    purchasedBookIds: (json['purchasedBookIds'] as List? ?? const []).map((e) => e.toString()).toList(),
    );
  }
}
