import 'package:flutter/foundation.dart';
import '../network/api_client.dart';
import 'app_notification.dart';

class NotificationsController extends ChangeNotifier {
  NotificationsController(this._client);

  final ApiClient _client;
  List<AppNotification> items = const [];
  bool loading = false;
  String? error;

  Future<void> load({bool forceRefresh = false}) async {
    if (loading) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final response = await _client.dio.get('/notifications');
      final raw = response.data is Map ? response.data['notifications'] : null;
      items = raw is List
          ? raw
                .whereType<Map>()
                .map(
                  (item) =>
                      AppNotification.fromJson(Map<String, dynamic>.from(item)),
                )
                .toList()
          : const [];
    } catch (exception) {
      error = _client.errorMessage(exception);
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}
