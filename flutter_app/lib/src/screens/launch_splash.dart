import 'package:flutter/material.dart';
import '../theme.dart';

class LaunchSplash extends StatefulWidget {
  const LaunchSplash({super.key});
  @override
  State<LaunchSplash> createState() => _LaunchSplashState();
}

class _LaunchSplashState extends State<LaunchSplash>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;
  late final Animation<double> scale;
  late final Animation<double> opacity;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    );
    scale = CurvedAnimation(parent: controller, curve: Curves.elasticOut);
    opacity = CurvedAnimation(
      parent: controller,
      curve: const Interval(0, .65, curve: Curves.easeOut),
    );
    controller.forward();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFFFF8EC),
    body: Center(
      child: FadeTransition(
        opacity: opacity,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ScaleTransition(
              scale: scale,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 245,
                    height: 245,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.saffron.withValues(alpha: .14),
                    ),
                  ),
                  Image.asset(
                    'assets/images/splash-mascot.png',
                    width: 220,
                    height: 220,
                    fit: BoxFit.contain,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: 'Happi',
                    style: TextStyle(color: AppColors.saffron),
                  ),
                  TextSpan(
                    text: 'Notes',
                    style: TextStyle(color: AppColors.coral),
                  ),
                ],
              ),
              style: TextStyle(
                fontSize: 38,
                fontWeight: FontWeight.w900,
                letterSpacing: -1.2,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Stories that stay with you.',
              style: TextStyle(
                color: Color(0xFF5B4034),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
