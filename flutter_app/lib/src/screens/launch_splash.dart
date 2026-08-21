import 'package:flutter/material.dart';
import '../theme.dart';

class LaunchSplash extends StatefulWidget {
  const LaunchSplash({super.key});
  @override
  State<LaunchSplash> createState() => _LaunchSplashState();
}

class _LaunchSplashState extends State<LaunchSplash>
    with TickerProviderStateMixin {
  late final AnimationController controller;
  late final AnimationController breathingController;
  late final Animation<double> scale;
  late final Animation<double> breathingScale;
  late final Animation<double> opacity;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    scale = Tween<double>(begin: .82, end: 1).animate(
      CurvedAnimation(parent: controller, curve: Curves.easeOutCubic),
    );
    opacity = CurvedAnimation(
      parent: controller,
      curve: Curves.easeOut,
    );
    breathingController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
    breathingScale = Tween<double>(begin: .985, end: 1.015).animate(
      CurvedAnimation(parent: breathingController, curve: Curves.easeInOut),
    );
    controller.forward();
  }

  @override
  void dispose() {
    controller.dispose();
    breathingController.dispose();
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
            AnimatedBuilder(
              animation: breathingScale,
              builder: (context, child) => Transform.scale(
                scale: breathingScale.value,
                child: child,
              ),
              child: ScaleTransition(
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
