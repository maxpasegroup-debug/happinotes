import { Ionicons } from "@expo/vector-icons";
import RazorpayCheckout from "react-native-razorpay";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "@/services/api";
import { AuthUser, getAuth, saveAuth } from "@/store/authStore";

type Plan = {
  id: "monthly" | "yearly" | "lifetime";
  name: string;
  price: number;
  durationDays: number;
  razorpayPlanId?: string;
};

type Offer = {
  _id: string;
  code?: string;
  discountPercent: number;
  appliesToPlan: Plan["id"] | "all";
};

type PlansResponse = {
  success: boolean;
  plans: Plan[];
};

type OffersResponse = {
  success: boolean;
  offers: Offer[];
};

type OrderResponse = {
  success: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  plan: Plan;
};

type VerifyResponse = {
  success: boolean;
  user: AuthUser;
};

const planCopy: Record<Plan["id"], string> = {
  monthly: "Perfect for trying the full library.",
  yearly: "Best value for steady listening.",
  lifetime: "One payment, permanent access.",
};

export default function Subscribe() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan["id"]>("yearly");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const auth = await getAuth();
      setUser(auth.user);

      const [plansResult, offersResult] = await Promise.all([
        api.get<PlansResponse>("/payments/plans"),
        api.get<OffersResponse>("/offers/active"),
      ]);

      if (plansResult.success && plansResult.data) {
        setPlans(plansResult.data.plans);
      } else {
        setError(plansResult.error || "Could not load plans.");
      }

      if (offersResult.success && offersResult.data) {
        setOffers(offersResult.data.offers);
      }

      setLoading(false);
    };

    load();
  }, []);

  const selected = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) || plans[0],
    [plans, selectedPlan]
  );

  const getOfferForPlan = (planId: Plan["id"]) =>
    offers.find((offer) => offer.appliesToPlan === planId || offer.appliesToPlan === "all");

  const getFinalPrice = (plan: Plan) => {
    const offer = getOfferForPlan(plan.id);
    if (!offer) return plan.price;
    return Math.max(0, Math.round(plan.price - (plan.price * offer.discountPercent) / 100));
  };

  const pay = async () => {
    if (!selected || !user) return;

    setPaying(true);
    setError("");

    const orderResult = await api.post<OrderResponse>("/payments/create-order", {
      planId: selected.id,
    });

    if (!orderResult.success || !orderResult.data) {
      setPaying(false);
      setError(orderResult.error || "Could not create payment order.");
      return;
    }

    try {
      const response = await RazorpayCheckout.open({
        key: orderResult.data.keyId,
        amount: orderResult.data.amount * 100,
        currency: orderResult.data.currency,
        name: "HappiNotes",
        description: orderResult.data.plan.name,
        order_id: orderResult.data.orderId,
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: "#FF6B4A",
        },
      });

      const verifyResult = await api.post<VerifyResponse>("/payments/verify", response);
      if (!verifyResult.success || !verifyResult.data) {
        setError(verifyResult.error || "Payment verification failed.");
        setPaying(false);
        return;
      }

      const { token } = await getAuth();
      if (token) await saveAuth(token, verifyResult.data.user);
      setUser(verifyResult.data.user);
      setSuccess(true);
    } catch (paymentError) {
      const message =
        paymentError instanceof Error ? paymentError.message : "Payment was cancelled or failed.";
      setError(message);
    } finally {
      setPaying(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.confetti}>
          {[...Array(18)].map((_, index) => (
            <View
              key={index}
              style={[
                styles.confettiDot,
                {
                  left: `${(index * 17) % 92}%`,
                  top: `${(index * 29) % 82}%`,
                  backgroundColor: index % 2 ? "#FF6B4A" : "#12B76A",
                },
              ]}
            />
          ))}
        </View>
        <Ionicons name="checkmark-circle" size={76} color="#12B76A" />
        <Text style={styles.successTitle}>Premium Unlocked</Text>
        <Text style={styles.successText}>Your HappiNotes subscription is active.</Text>
        <Pressable style={styles.successButton} onPress={() => router.replace("/(app)/home")}>
          <Text style={styles.successButtonText}>Start Listening</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Go Premium</Text>
      <Text style={styles.subheader}>Unlock every premium audiobook and chapter.</Text>

      {loading ? <Text style={styles.muted}>Loading plans...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {plans.map((plan) => {
        const active = selectedPlan === plan.id;
        const offer = getOfferForPlan(plan.id);
        const finalPrice = getFinalPrice(plan);

        return (
          <Pressable
            key={plan.id}
            style={[styles.planCard, active && styles.planCardActive]}
            onPress={() => setSelectedPlan(plan.id)}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planCopy}>{planCopy[plan.id]}</Text>
              </View>
              {plan.id === "yearly" ? <Text style={styles.bestValue}>Best Value</Text> : null}
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.price}>INR {finalPrice}</Text>
              {offer ? <Text style={styles.oldPrice}>INR {plan.price}</Text> : null}
            </View>
            {offer ? (
              <Text style={styles.offer}>
                {offer.discountPercent}% off {offer.code ? `with ${offer.code}` : "active now"}
              </Text>
            ) : null}
          </Pressable>
        );
      })}

      <Pressable style={styles.payButton} onPress={pay} disabled={paying || !selected}>
        <Text style={styles.payButtonText}>
          {paying ? "Opening checkout..." : selected ? `Pay INR ${getFinalPrice(selected)}` : "Pay"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    padding: 20,
    paddingBottom: 130,
    paddingTop: 54,
  },
  header: {
    color: "#181818",
    fontSize: 30,
    fontWeight: "900",
  },
  subheader: {
    color: "#667085",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
    marginTop: 8,
  },
  planCard: {
    borderColor: "#D0D5DD",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  planCardActive: {
    borderColor: "#FF6B4A",
    borderWidth: 2,
  },
  planHeader: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  planName: {
    color: "#181818",
    fontSize: 18,
    fontWeight: "900",
  },
  planCopy: {
    color: "#667085",
    marginTop: 5,
  },
  bestValue: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF0E8",
    borderRadius: 4,
    color: "#B54708",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  priceRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  price: {
    color: "#181818",
    fontSize: 25,
    fontWeight: "900",
  },
  oldPrice: {
    color: "#98A2B3",
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  offer: {
    color: "#067647",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
  },
  payButton: {
    alignItems: "center",
    backgroundColor: "#FF6B4A",
    borderRadius: 8,
    marginTop: 10,
    padding: 17,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  muted: {
    color: "#667085",
    marginBottom: 12,
  },
  error: {
    color: "#B42318",
    marginBottom: 12,
  },
  successContainer: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
    padding: 24,
  },
  confetti: {
    ...StyleSheet.absoluteFillObject,
  },
  confettiDot: {
    borderRadius: 5,
    height: 10,
    position: "absolute",
    width: 10,
  },
  successTitle: {
    color: "#181818",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 18,
  },
  successText: {
    color: "#667085",
    marginTop: 8,
    textAlign: "center",
  },
  successButton: {
    backgroundColor: "#FF6B4A",
    borderRadius: 8,
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  successButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});
