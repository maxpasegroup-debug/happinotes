class MembershipPlan {
  const MembershipPlan({
    required this.id,
    required this.name,
    required this.price,
    required this.durationDays,
  });
  final String id, name;
  final int price, durationDays;
}
