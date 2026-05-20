import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/services/api";

type Payment = {
  _id: string;
  planId: string;
  amountINR: number;
  status: "pending" | "completed" | "failed" | "refunded";
  createdAt: string;
};

type PaymentHistoryResponse = {
  success: boolean;
  payments: Payment[];
};

export default function History() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const result = await api.get<PaymentHistoryResponse>("/payments/history");
        if (result.success && result.data) {
          setPayments(result.data.payments);
          setError("");
        } else {
          setError(result.error || "Could not load payment history.");
        }
      };

      load();
    }, [])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Payment History</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!payments.length && !error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No payments yet</Text>
          <Text style={styles.emptyText}>Your subscription purchases will appear here.</Text>
        </View>
      ) : null}

      {payments.map((payment) => (
        <View key={payment._id} style={styles.card}>
          <View>
            <Text style={styles.plan}>{payment.planId.toUpperCase()}</Text>
            <Text style={styles.date}>{new Date(payment.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.amount}>INR {payment.amountINR}</Text>
            <Text style={[styles.status, styles[payment.status]]}>{payment.status}</Text>
          </View>
        </View>
      ))}
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
    paddingTop: 54,
  },
  header: {
    color: "#181818",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 20,
  },
  empty: {
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    padding: 24,
  },
  emptyTitle: {
    color: "#181818",
    fontWeight: "900",
  },
  emptyText: {
    color: "#667085",
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 16,
  },
  plan: {
    color: "#181818",
    fontWeight: "900",
  },
  date: {
    color: "#667085",
    marginTop: 4,
  },
  right: {
    alignItems: "flex-end",
  },
  amount: {
    color: "#181818",
    fontWeight: "900",
  },
  status: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "uppercase",
  },
  completed: {
    color: "#067647",
  },
  pending: {
    color: "#B54708",
  },
  failed: {
    color: "#B42318",
  },
  refunded: {
    color: "#475467",
  },
  error: {
    color: "#B42318",
    marginBottom: 12,
  },
});
