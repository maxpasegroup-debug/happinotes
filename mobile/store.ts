import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = "user" | "admin";
export type SubscriptionType = "free" | "premium";

export type Book = {
  id: string;
  title: string;
  access: "free" | "premium";
};

/* ---------------- STORAGE KEYS ---------------- */

const BOOKS_KEY = "books";
const COLLECTION_KEY = "collection";
const ROLE_KEY = "role";
const SUB_KEY = "subscription";
const USER_KEY = "current_user";

/* =====================================================
   USER LOGIN + ROLE
===================================================== */

export const setCurrentUser = async (email: string) => {
  await AsyncStorage.setItem(USER_KEY, email);

  if (email === "arundasmd@gmail.com") {
    await AsyncStorage.setItem(ROLE_KEY, "admin");
    return { email, role: "admin" as UserRole };
  }

  await AsyncStorage.setItem(ROLE_KEY, "user");
  return { email, role: "user" as UserRole };
};

export const getCurrentUser = async () => {
  const email = await AsyncStorage.getItem(USER_KEY);
  const role = await AsyncStorage.getItem(ROLE_KEY);

  return {
    email: email || "",
    role: (role as UserRole) || "user",
  };
};

export const getUserRole = async (): Promise<UserRole> => {
  const role = await AsyncStorage.getItem(ROLE_KEY);
  return (role as UserRole) || "user";
};

/* =====================================================
   LOGOUT
===================================================== */

export const logoutUser = async () => {
  await AsyncStorage.removeItem(USER_KEY);
  await AsyncStorage.removeItem(ROLE_KEY);
  await AsyncStorage.removeItem(SUB_KEY);
};

/* =====================================================
   SUBSCRIPTION
===================================================== */

export const setSubscription = async (type: SubscriptionType) => {
  await AsyncStorage.setItem(SUB_KEY, type);
};

export const getSubscription = async (): Promise<SubscriptionType> => {
  const sub = await AsyncStorage.getItem(SUB_KEY);
  return (sub as SubscriptionType) || "free";
};

/* =====================================================
   BOOKS
===================================================== */

export const saveBooks = async (books: Book[]) => {
  await AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(books));
};

export const getBooks = async (): Promise<Book[]> => {
  const data = await AsyncStorage.getItem(BOOKS_KEY);
  return data ? JSON.parse(data) : [];
};

/* =====================================================
   COLLECTION
===================================================== */

export const addToCollection = async (book: Book) => {
  const existing = await AsyncStorage.getItem(COLLECTION_KEY);
  const collection: Book[] = existing ? JSON.parse(existing) : [];

  collection.push(book);

  await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
};

export const getCollection = async (): Promise<Book[]> => {
  const data = await AsyncStorage.getItem(COLLECTION_KEY);
  return data ? JSON.parse(data) : [];
};