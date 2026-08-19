import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../theme.dart';

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    required this.height,
    this.radius = 10,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) => Shimmer.fromColors(
    baseColor: AppColors.raised,
    highlightColor: const Color(0xFF3A3A3A),
    period: const Duration(milliseconds: 1200),
    child: Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.raised,
        borderRadius: BorderRadius.circular(radius),
      ),
    ),
  );
}

class HomeLoadingSkeleton extends StatelessWidget {
  const HomeLoadingSkeleton({super.key});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const SkeletonBox(height: 210, radius: 22),
      const SizedBox(height: 28),
      const SkeletonBox(width: 150, height: 20),
      const SizedBox(height: 12),
      SizedBox(
        height: 245,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 3,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (_, _) => const SizedBox(
            width: 138,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(height: 190, radius: 12),
                SizedBox(height: 9),
                SkeletonBox(height: 14),
                SizedBox(height: 7),
                SkeletonBox(width: 90, height: 11),
              ],
            ),
          ),
        ),
      ),
    ],
  );
}

class ListLoadingSkeleton extends StatelessWidget {
  const ListLoadingSkeleton({super.key, this.items = 6});
  final int items;

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(16),
    physics: const NeverScrollableScrollPhysics(),
    itemCount: items,
    separatorBuilder: (_, _) => const SizedBox(height: 14),
    itemBuilder: (_, _) => const Row(
      children: [
        SkeletonBox(width: 62, height: 82, radius: 10),
        SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonBox(height: 16),
              SizedBox(height: 10),
              SkeletonBox(width: 150, height: 12),
              SizedBox(height: 8),
              SkeletonBox(width: 90, height: 12),
            ],
          ),
        ),
      ],
    ),
  );
}

class GridLoadingSkeleton extends StatelessWidget {
  const GridLoadingSkeleton({super.key});

  @override
  Widget build(BuildContext context) => GridView.builder(
    padding: const EdgeInsets.all(16),
    physics: const NeverScrollableScrollPhysics(),
    itemCount: 6,
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 2,
      childAspectRatio: .58,
      crossAxisSpacing: 14,
      mainAxisSpacing: 16,
    ),
    itemBuilder: (_, _) => const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: SkeletonBox(height: double.infinity, radius: 12)),
        SizedBox(height: 9),
        SkeletonBox(height: 14),
        SizedBox(height: 7),
        SkeletonBox(width: 90, height: 11),
      ],
    ),
  );
}

class DashboardLoadingSkeleton extends StatelessWidget {
  const DashboardLoadingSkeleton({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(18),
    children: const [
      SkeletonBox(width: 180, height: 28),
      SizedBox(height: 10),
      SkeletonBox(width: 250, height: 14),
      SizedBox(height: 24),
      Row(children: [
        Expanded(child: SkeletonBox(height: 130, radius: 14)),
        SizedBox(width: 12),
        Expanded(child: SkeletonBox(height: 130, radius: 14)),
      ]),
      SizedBox(height: 12),
      Row(children: [
        Expanded(child: SkeletonBox(height: 130, radius: 14)),
        SizedBox(width: 12),
        Expanded(child: SkeletonBox(height: 130, radius: 14)),
      ]),
    ],
  );
}
