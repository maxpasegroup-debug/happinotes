import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../features/auth/data/repositories/auth_repository_impl.dart';
import '../features/auth/domain/repositories/auth_repository.dart';
import '../features/auth/presentation/controllers/session_controller.dart';
import '../features/auth/presentation/controllers/auth_form_controller.dart';
import '../features/books/data/repositories/books_repository_impl.dart';
import '../features/books/domain/repositories/books_repository.dart';
import '../features/books/presentation/controllers/books_controller.dart';
import '../features/membership/data/repositories/membership_repository_impl.dart';
import '../features/membership/domain/repositories/membership_repository.dart';
import '../features/membership/presentation/controllers/membership_controller.dart';
import '../features/player/presentation/controllers/player_controller.dart';
import '../features/admin/data/repositories/admin_repository_impl.dart';
import '../features/admin/domain/repositories/admin_repository.dart';
import '../features/admin/presentation/controllers/admin_controller.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepositoryImpl(ref.watch(apiClientProvider)),
);
final booksRepositoryProvider = Provider<BooksRepository>(
  (ref) => BooksRepositoryImpl(ref.watch(apiClientProvider)),
);
final membershipRepositoryProvider = Provider<MembershipRepository>(
  (ref) => MembershipRepositoryImpl(ref.watch(apiClientProvider)),
);
final sessionControllerProvider = ChangeNotifierProvider<SessionController>(
  (ref) => SessionController(ref.watch(authRepositoryProvider))..initialize(),
);
final authFormControllerProvider = ChangeNotifierProvider<AuthFormController>(
  (ref) => AuthFormController(
    ref.watch(sessionControllerProvider),
    ref.watch(apiClientProvider),
  ),
);
final mainTabIndexProvider = StateProvider<int>((ref) => 0);
final searchQueryProvider = StateProvider<String>((ref) => '');
final searchLanguageProvider = StateProvider<String>((ref) => 'all');
final adminNotificationTitleProvider = StateProvider<String>((ref) => '');
final adminNotificationMessageProvider = StateProvider<String>((ref) => '');
final adminNotificationTargetProvider = StateProvider<String>((ref) => 'all');
final adminRepositoryProvider = Provider<AdminRepository>(
  (ref) => AdminRepositoryImpl(ref.watch(apiClientProvider)),
);
final adminControllerProvider = ChangeNotifierProvider<AdminController>(
  (ref) => AdminController(
    ref.watch(adminRepositoryProvider),
    ref.watch(apiClientProvider),
  ),
);
final booksControllerProvider = ChangeNotifierProvider<BooksController>(
  (ref) => BooksController(
    ref.watch(booksRepositoryProvider),
    ref.watch(apiClientProvider),
  ),
);
final playerControllerProvider = ChangeNotifierProvider<PlayerController>(
  (ref) => PlayerController(),
);
final membershipControllerProvider =
    ChangeNotifierProvider.autoDispose<MembershipController>(
      (ref) => MembershipController(
        ref.watch(membershipRepositoryProvider),
        ref.watch(sessionControllerProvider),
        ref.watch(apiClientProvider),
      ),
    );
