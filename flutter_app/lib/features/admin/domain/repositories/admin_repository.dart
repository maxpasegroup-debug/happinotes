abstract class AdminRepository {
  Future<Map<String, dynamic>> getStats();
  Future<List<Map<String, dynamic>>> getBooks();
  Future<List<Map<String, dynamic>>> getUsers();
  Future<void> updateUserSubscription(String id, String status);
  Future<void> deleteUser(String id);
  Future<Map<String, dynamic>> upload(String path, String scope);
  Future<Map<String, dynamic>> createBook(Map<String, dynamic> data);
  Future<void> updateBook(String id, Map<String, dynamic> data);
  Future<void> updateBookStatus(String id, String status);
  Future<void> deleteBook(String id);
  Future<void> sendNotification(String title, String message, String target);
}
