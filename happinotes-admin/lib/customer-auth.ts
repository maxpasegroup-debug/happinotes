export type CustomerAuthPurpose = "signup" | "login";

export type CustomerAuthUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: "admin" | "user";
};

export type CustomerAuthResponse = {
  token: string;
  user: CustomerAuthUser;
};

type EmailOtpResponse = {
  emailChallenge?: string;
  resendAfterSeconds?: number;
};

type Fetcher = typeof fetch;

async function post<T>(
  baseUrl: string,
  path: string,
  payload: Record<string, string>,
  fetcher: Fetcher,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetcher(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : fallbackMessage);
  }
  return data;
}

export async function requestCustomerEmailOtp(
  baseUrl: string,
  email: string,
  purpose: CustomerAuthPurpose,
  fetcher: Fetcher = fetch,
): Promise<{ resendAfterSeconds: number }> {
  const response = await post<EmailOtpResponse>(
    baseUrl,
    "/auth/request-email-otp",
    { email: email.trim().toLowerCase(), purpose },
    fetcher,
    "Could not send a code. Please try again.",
  );
  return {
    resendAfterSeconds: Number.isFinite(response.resendAfterSeconds)
      ? Math.max(0, Math.floor(response.resendAfterSeconds!))
      : 60,
  };
}

export async function verifyCustomerEmailOtp(
  baseUrl: string,
  email: string,
  purpose: CustomerAuthPurpose,
  otp: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const response = await post<EmailOtpResponse>(
    baseUrl,
    "/auth/verify-email-otp",
    { email: email.trim().toLowerCase(), purpose, otp: otp.trim() },
    fetcher,
    "Invalid or expired code. Request a new one and try again.",
  );
  if (!response.emailChallenge) {
    throw new Error("The code could not be verified. Request a new one and try again.");
  }
  return response.emailChallenge;
}

export async function createCustomerAccount(
  baseUrl: string,
  details: { name: string; email: string; password: string; emailChallenge: string },
  fetcher: Fetcher = fetch,
): Promise<CustomerAuthResponse> {
  const response = await post<CustomerAuthResponse>(
    baseUrl,
    "/auth/signup",
    {
      name: details.name.trim(),
      email: details.email.trim().toLowerCase(),
      password: details.password,
      emailChallenge: details.emailChallenge,
    },
    fetcher,
    "Could not create your account. Please check your details and try again.",
  );
  if (!response.token || !response.user) throw new Error("Account creation did not return a valid session.");
  return response;
}

export async function loginCustomer(
  baseUrl: string,
  details: { email: string; password: string; emailChallenge: string },
  fetcher: Fetcher = fetch,
): Promise<CustomerAuthResponse> {
  const response = await post<CustomerAuthResponse>(
    baseUrl,
    "/auth/login",
    {
      email: details.email.trim().toLowerCase(),
      password: details.password,
      emailChallenge: details.emailChallenge,
    },
    fetcher,
    "Could not sign in. Please check your details and try again.",
  );
  if (!response.token || !response.user) throw new Error("Sign in did not return a valid session.");
  return response;
}
