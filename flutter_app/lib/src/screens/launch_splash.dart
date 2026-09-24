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
    scale = Tween<double>(
      begin: .94,
      end: 1,
    ).animate(controller.drive(CurveTween(curve: Curves.easeOutCubic)));
    opacity = Tween<double>(begin: .55, end: 1).animate(
      controller.drive(CurveTween(curve: Curves.easeInOut)),
    );
    // Start after the first frame so MediaQuery and the asset tree are ready.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final disableAnimations = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
      if (disableAnimations) {
        controller.value = 1;
      } else if (!controller.isAnimating && controller.isDismissed) {
        // Keep the splash alive with a subtle breathing animation while the
        // saved session is being restored. The screen is replaced as soon as
        // initialization completes.
        controller.repeat(reverse: true, period: const Duration(milliseconds: 1200));
      }
    });
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFFFF8EC),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
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
                        width: 220,
                        height: 220,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.saffron.withValues(alpha: .14),
                        ),
                      ),
                      Image.asset(
                        'assets/images/splash-mascot.png',
                        width: 196,
                        height: 196,
                        fit: BoxFit.contain,
                        cacheWidth: 392,
                        cacheHeight: 392,
                        filterQuality: FilterQuality.medium,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(
                              Icons.auto_stories_rounded,
                              size: 120,
                              color: AppColors.saffron,
                            ),
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
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                const Text(
                  'Stories that stay with you.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFF5B4034),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 28),
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.saffron,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
