import { useState } from "react";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import BookForm, { type BookPayload } from "@/components/admin/BookForm";
import { api } from "@/services/api";
import type { Book } from "@/types/book";

export default function CreateBook() {
  const router = useRouter(); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (payload: BookPayload) => { setSaving(true); setError(""); const result = await api.post<{success:boolean;book:Book}>("/admin/books", payload); setSaving(false); if (!result.success) { setError(result.error || "Could not create book."); return; } Toast.show({type:"success",text1:"Book created",text2: payload.status === "live" ? "Now visible to listeners." : "Saved to the catalog."}); router.replace("/(admin)/books"); };
  return <BookForm submitLabel="Create book" saving={saving} error={error} onSubmit={submit} />;
}
