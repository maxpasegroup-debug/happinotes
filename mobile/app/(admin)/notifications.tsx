import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/services/api";

type Audience = "all" | "free" | "premium";
type SendResponse = { success: boolean; recipients: number; accepted: number; failed: number };

export default function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<Audience>("all");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    setError("");
    if (!cleanTitle || !cleanMessage) return setError("Add a title and message.");

    Alert.alert("Send notification?", `Send this message to ${target === "all" ? "all registered users" : `${target} users`}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: async () => {
          setSending(true);
          const result = await api.post<SendResponse>("/admin/notify", { title: cleanTitle, message: cleanMessage, target });
          setSending(false);
          if (!result.success || !result.data) return setError(result.error || "Notification could not be sent.");
          const { recipients, accepted, failed } = result.data;
          Alert.alert("Notification processed", recipients ? `${accepted} accepted by Expo${failed ? `, ${failed} failed` : ""}.` : "No registered devices are available yet.");
          if (accepted) { setTitle(""); setMessage(""); }
        },
      },
    ]);
  };

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>AUDIENCE MESSAGE</Text>
      <Text style={styles.heading}>Push notifications</Text>
      <Text style={styles.copy}>Send a short update to devices that have granted notification permission.</Text>

      <Text style={styles.label}>Audience</Text>
      <View style={styles.targets}>
        {(["all", "free", "premium"] as Audience[]).map((item) => <Pressable key={item} onPress={() => setTarget(item)} style={[styles.target, target === item && styles.targetActive]}><Text style={[styles.targetText, target === item && styles.targetTextActive]}>{item}</Text></Pressable>)}
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} maxLength={100} placeholder="New audiobook available" style={styles.input} />
      <Text style={styles.counter}>{title.length}/100</Text>

      <Text style={styles.label}>Message</Text>
      <TextInput value={message} onChangeText={setMessage} maxLength={500} multiline textAlignVertical="top" placeholder="Tell listeners what is new…" style={[styles.input, styles.message]} />
      <Text style={styles.counter}>{message.length}/500</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={sending} onPress={send} style={[styles.send, sending && styles.disabled]}><Text style={styles.sendText}>{sending ? "Sending…" : "Send notification"}</Text></Pressable>
      <Text style={styles.note}>Remote notifications require a development or store build. Expo Go cannot receive remote push notifications.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({screen:{flex:1,backgroundColor:"#F7F3EE"},content:{padding:20,paddingBottom:50},eyebrow:{color:"#FF6B4A",fontSize:12,fontWeight:"900",letterSpacing:1.4},heading:{color:"#181818",fontSize:30,fontWeight:"900",marginTop:6},copy:{color:"#665E58",lineHeight:21,marginBottom:26,marginTop:8},label:{color:"#36302C",fontSize:13,fontWeight:"900",marginBottom:8,marginTop:16},targets:{flexDirection:"row",flexWrap:"wrap",gap:8},target:{borderColor:"#CFC6BE",borderRadius:8,borderWidth:1,paddingHorizontal:16,paddingVertical:11},targetActive:{backgroundColor:"#181818",borderColor:"#181818"},targetText:{color:"#4F4843",fontWeight:"800",textTransform:"capitalize"},targetTextActive:{color:"#FFF"},input:{backgroundColor:"#FFF",borderColor:"#D9D1CA",borderRadius:8,borderWidth:1,color:"#181818",paddingHorizontal:14,paddingVertical:13},message:{minHeight:140},counter:{color:"#8A817B",fontSize:11,marginTop:5,textAlign:"right"},error:{color:"#B42318",fontWeight:"700",marginTop:16},send:{alignItems:"center",backgroundColor:"#FF6B4A",borderRadius:8,justifyContent:"center",marginTop:22,minHeight:54},sendText:{color:"#FFF",fontSize:16,fontWeight:"900"},disabled:{opacity:.55},note:{color:"#756D67",fontSize:12,lineHeight:18,marginTop:14,textAlign:"center"}});
