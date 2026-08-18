import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

type LaunchSplashProps = {
  onLayout: () => void;
};

export function LaunchSplash({ onLayout }: LaunchSplashProps) {
  const mascot = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(0)).current;
  const haloOne = useRef(new Animated.Value(0)).current;
  const haloTwo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((reducedMotion) => {
      if (!active) return;

      if (reducedMotion) {
        mascot.setValue(1);
        copy.setValue(1);
        return;
      }

      Animated.parallel([
        Animated.spring(mascot, {
          toValue: 1,
          damping: 13,
          stiffness: 125,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(copy, {
          toValue: 1,
          duration: 420,
          delay: 170,
          useNativeDriver: true,
        }),
        Animated.timing(haloOne, {
          toValue: 1,
          duration: 850,
          delay: 80,
          useNativeDriver: true,
        }),
        Animated.timing(haloTwo, {
          toValue: 1,
          duration: 900,
          delay: 210,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      active = false;
    };
  }, [copy, haloOne, haloTwo, mascot]);

  return (
    <LinearGradient
      colors={["#FFF8EC", "#FFF3DA", "#FFF8EC"]}
      locations={[0, 0.55, 1]}
      style={styles.screen}
      onLayout={onLayout}
      accessibilityLabel="HappiNotes is starting"
    >
      <StatusBar style="dark" backgroundColor="#FFF8EC" />
      <View style={styles.sunrise} />

      <View style={styles.brandLockup}>
        <View style={styles.mascotStage}>
          <Animated.View
            style={[
              styles.halo,
              styles.haloOne,
              {
                opacity: haloOne.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.34, 0] }),
                transform: [{ scale: haloOne.interpolate({ inputRange: [0, 1], outputRange: [0.66, 1.22] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.halo,
              styles.haloTwo,
              {
                opacity: haloTwo.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.24, 0] }),
                transform: [{ scale: haloTwo.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.42] }) }],
              },
            ]}
          />
          <Animated.View
            style={{
              opacity: mascot,
              transform: [
                { scale: mascot.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) },
                { translateY: mascot.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
              ],
            }}
          >
            <Image
              source={require("../assets/images/splash-mascot.png")}
              style={styles.mascot}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.copy,
            {
              opacity: copy,
              transform: [{ translateY: copy.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }],
            },
          ]}
        >
          <Text style={styles.wordmark}>
            <Text style={styles.happi}>Happi</Text>
            <Text style={styles.notes}>Notes</Text>
          </Text>
          <View style={styles.rule} />
          <Text style={styles.tagline}>Stories that stay with you.</Text>
        </Animated.View>
      </View>

      <View style={styles.bottomMark}>
        <View style={styles.bottomDot} />
        <View style={styles.bottomLine} />
        <View style={styles.bottomDot} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sunrise: {
    position: "absolute",
    width: 390,
    height: 390,
    borderRadius: 195,
    backgroundColor: "#FFC928",
    opacity: 0.13,
    transform: [{ translateY: -40 }],
    shadowColor: "#F59E0B",
    shadowOpacity: 0.28,
    shadowRadius: 52,
    elevation: 2,
  },
  brandLockup: {
    alignItems: "center",
    transform: [{ translateY: -18 }],
  },
  mascotStage: {
    width: 250,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
  },
  mascot: {
    width: 222,
    height: 222,
  },
  halo: {
    position: "absolute",
    borderColor: "#F04432",
    borderWidth: 2,
  },
  haloOne: {
    width: 206,
    height: 206,
    borderRadius: 103,
  },
  haloTwo: {
    width: 222,
    height: 222,
    borderRadius: 111,
    borderColor: "#FFC928",
  },
  copy: {
    alignItems: "center",
    marginTop: 5,
  },
  wordmark: {
    fontSize: 42,
    lineHeight: 49,
    fontWeight: "900",
    letterSpacing: -1.7,
  },
  happi: {
    color: "#F6B900",
  },
  notes: {
    color: "#F04432",
  },
  rule: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#3B241A",
    marginTop: 12,
    marginBottom: 13,
    opacity: 0.85,
  },
  tagline: {
    color: "#5B4034",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    letterSpacing: 0.25,
  },
  bottomMark: {
    position: "absolute",
    bottom: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    opacity: 0.5,
  },
  bottomDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#F04432",
  },
  bottomLine: {
    width: 34,
    height: 2,
    backgroundColor: "#FFC928",
  },
});
