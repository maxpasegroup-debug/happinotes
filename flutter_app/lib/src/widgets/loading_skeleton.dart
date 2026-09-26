import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

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
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = scheme.surfaceContainerHighest;
    final highlight = Theme.of(context).brightness == Brightness.dark
        ? Color.alphaBlend(Colors.white.withValues(alpha: .10), base)
        : Color.alphaBlend(Colors.white.withValues(alpha: .72), base);
    return Shimmer.fromColors(
      baseColor: base,
      highlightColor: highlight,
      period: const Duration(milliseconds: 1200),
      direction: ShimmerDirection.ltr,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: base,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}

class HomeLoadingSkeleton extends StatelessWidget {
  const HomeLoadingSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final cardWidth = (width * .36).clamp(124.0, 152.0);
    final coverHeight = cardWidth / .72;
    final cardHeight = coverHeight + 9 + 14 + 7 + 11;
    final featuredHeight = (width * .95).clamp(300.0, 374.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SkeletonBox(height: featuredHeight, radius: 22),
        const SizedBox(height: 28),
        const SkeletonBox(width: 150, height: 20),
        const SizedBox(height: 12),
        SizedBox(
          height: cardHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 3,
            separatorBuilder: (_, _) => const SizedBox(width: 16),
            itemBuilder: (_, _) => SizedBox(
              width: cardWidth,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: SkeletonBox(height: coverHeight, radius: 12)),
                  const SizedBox(height: 9),
                  const SkeletonBox(height: 14),
                  const SizedBox(height: 7),
                  const SkeletonBox(width: 90, height: 11),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
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
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final cardWidth = (width - 32 - 18) / 2;
    final coverHeight = cardWidth / .72;
    final cardHeight = coverHeight + 9 + 14 + 7 + 11;
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 6,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 18,
        mainAxisSpacing: 18,
        mainAxisExtent: cardHeight,
      ),
      itemBuilder: (_, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: SkeletonBox(height: coverHeight, radius: 12)),
          const SizedBox(height: 9),
          const SkeletonBox(height: 14),
          const SizedBox(height: 7),
          const SkeletonBox(width: 90, height: 11),
        ],
      ),
    );
  }
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
