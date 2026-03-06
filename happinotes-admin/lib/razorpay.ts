import { BASE_URL } from "@/lib/content-api";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function startRazorpaySubscriptionFlow(params: {
  token: string;
  email?: string;
  name?: string;
  plan?: "monthly" | "yearly";
  onSuccessRedirectUrl?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!key) {
    return { ok: false, message: "Razorpay key is not configured." };
  }

  const scriptReady = await loadRazorpayScript();
  if (!scriptReady || !window.Razorpay) {
    return { ok: false, message: "Unable to load Razorpay." };
  }

  try {
    const plan = params.plan || "monthly";
    const orderRes = await fetch(`${BASE_URL}/payments/razorpay/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify({ plan }),
    });

    if (!orderRes.ok) {
      return {
        ok: false,
        message: "Razorpay payment API is not configured yet.",
      };
    }

    const orderData = (await orderRes.json()) as {
      orderId: string;
      subscriptionId: string;
      amount: number;
      currency: string;
      key?: string;
    };

    return await new Promise((resolve) => {
      const Razorpay = window.Razorpay;
      if (!Razorpay) {
        resolve({ ok: false, message: "Unable to load Razorpay." });
        return;
      }

      const razorpay = new Razorpay({
        key,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Happinotes",
        description: "Happinotes Premium Subscription",
        subscription_id: orderData.subscriptionId,
        prefill: {
          email: params.email,
          name: params.name,
        },
        modal: {
          ondismiss: () => resolve({ ok: false, message: "Payment cancelled." }),
        },
        theme: { color: "#f6c453" },
        handler: async (response: Record<string, string>) => {
          try {
            const verifyRes = await fetch(`${BASE_URL}/payments/razorpay/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${params.token}`,
              },
              body: JSON.stringify(response),
            });
            if (!verifyRes.ok) {
              resolve({ ok: false, message: "Payment verification failed." });
              return;
            }
            if (params.onSuccessRedirectUrl && typeof window !== "undefined") {
              window.location.href = params.onSuccessRedirectUrl;
            }
            resolve({ ok: true });
          } catch {
            resolve({ ok: false, message: "Payment verification failed." });
          }
        },
      });
      razorpay.open();
    });
  } catch {
    return { ok: false, message: "Unable to start Razorpay payment." };
  }
}
