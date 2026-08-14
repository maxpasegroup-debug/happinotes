import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import BookForm, { type BookPayload } from "@/components/admin/BookForm";
import { api } from "@/services/api";
import type { Book } from "@/types/book";

export default function EditBook() {
  const { id } = useLocalSearchParams<{id:string}>(); const router = useRouter(); const [book,setBook]=useState<Book>(); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{ if(!id){setError("Book ID is missing.");setLoading(false);return;} api.get<{success:boolean;book:Book}>(`/admin/books/${id}`).then((result)=>{if(result.success&&result.data)setBook(result.data.book);else setError(result.error||"Could not load book.");}).finally(()=>setLoading(false));},[id]);
  const submit=async(payload:BookPayload)=>{setSaving(true);setError("");const result=await api.put<{success:boolean;book:Book}>(`/admin/books/${id}`,payload);setSaving(false);if(!result.success){setError(result.error||"Could not update book.");return;}Toast.show({type:"success",text1:"Book updated",text2:"Open listener apps are syncing now."});router.replace("/(admin)/books");};
  if(loading)return <View style={styles.center}><ActivityIndicator color="#FF6B4A"/><Text style={styles.note}>Loading edition…</Text></View>;
  if(!book)return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable onPress={()=>router.back()}><Text style={styles.link}>Go back</Text></Pressable></View>;
  return <BookForm initial={book} submitLabel="Save changes" saving={saving} error={error} onSubmit={submit}/>;
}
const styles=StyleSheet.create({center:{flex:1,alignItems:"center",justifyContent:"center",padding:24,backgroundColor:"#F7F3EE"},note:{color:"#665E58",marginTop:12},error:{color:"#B42318",textAlign:"center"},link:{color:"#FF6B4A",fontWeight:"800",marginTop:15}});
