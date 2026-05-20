import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = "admin" | "user";
export type LanguagePreference = "english" | "malayalam" | "hindi" | "all";
export type SubscriptionStatus = "free" | "premium" | "lifetime";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  languagePreference: LanguagePreference;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiry: string | null;
  razorpaySubscriptionId?: string | null;
};

export const JWT_TOKEN_KEY = "jwt_token";
export const CURRENT_USER_KEY = "current_user";

export const saveAuth = async (token: string, user: AuthUser) => {
  await AsyncStorage.multiSet([
    [JWT_TOKEN_KEY, token],
    [CURRENT_USER_KEY, JSON.stringify(user)],
  ]);
};

export const getAuth = async (): Promise<{ token: string | null; user: AuthUser | null }> => {
  const [[, token], [, storedUser]] = await AsyncStorage.multiGet([
    JWT_TOKEN_KEY,
    CURRENT_USER_KEY,
  ]);

  return {
    token,
    user: storedUser ? (JSON.parse(storedUser) as AuthUser) : null,
  };
};

export const clearAuth = async () => {
  await AsyncStorage.multiRemove([JWT_TOKEN_KEY, CURRENT_USER_KEY]);
};

export const isLoggedIn = async () => {
  const token = await AsyncStorage.getItem(JWT_TOKEN_KEY);
  return Boolean(token);
};

export const isAdmin = async () => {
  const { user } = await getAuth();
  return user?.role === "admin";
};
