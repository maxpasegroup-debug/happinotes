import '../../domain/entities/user.dart';

class UserModel extends User {
  const UserModel({
    required super.id,
    required super.name,
    required super.role,
    super.phoneNumber,
    super.subscriptionStatus,
    super.languagePreference,
  });
  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
    id: (json['id'] ?? json['_id'] ?? '').toString(),
    name: (json['name'] ?? '').toString(),
    role: (json['role'] ?? 'user').toString(),
    phoneNumber: json['phoneNumber']?.toString(),
    subscriptionStatus: (json['subscriptionStatus'] ?? 'free').toString(),
    languagePreference: (json['languagePreference'] ?? 'all').toString(),
  );
}
