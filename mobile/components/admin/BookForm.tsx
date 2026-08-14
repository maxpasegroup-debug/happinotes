import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import type { Book, BookAccessType, BookCategory, BookLanguage, BookStatus } from "@/types/book";
import { api } from "@/services/api";

export type BookPayload = Omit<Book, "_id">;
type Props = { initial?: Partial<Book>; submitLabel: string; saving: boolean; error?: string; onSubmit: (value: BookPayload) => void };
type UploadResponse = { success: boolean; media: { url: string; publicId: string } };

const options = {
  language: ["english", "malayalam", "hindi"] as BookLanguage[],
  category: ["health", "wealth", "happiness", "mindfulness"] as BookCategory[],
  status: ["draft", "upcoming", "live"] as BookStatus[],
  accessType: ["free", "premium"] as BookAccessType[],
};

export default function BookForm({ initial = {}, submitLabel, saving, error, onSubmit }: Props) {
  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");
  const [language, setLanguage] = useState<BookLanguage>(initial.language || "english");
  const [category, setCategory] = useState<BookCategory>(initial.category || "happiness");
  const [status, setStatus] = useState<BookStatus>(initial.status || "draft");
  const [accessType, setAccessType] = useState<BookAccessType>(initial.accessType || "free");
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl || "");
  const [coverPublicId, setCoverPublicId] = useState(initial.coverPublicId || "");
  const [introAudioUrl, setIntroAudioUrl] = useState(initial.introAudioUrl || "");
  const [introAudioPublicId, setIntroAudioPublicId] = useState(initial.introAudioPublicId || "");
  const [introAudioFileName, setIntroAudioFileName] = useState(initial.introAudioFileName || "");
  const [duration, setDuration] = useState(String(initial.totalDurationSeconds || 0));
  const [sortOrder, setSortOrder] = useState(String(initial.sortOrder || 0));
  const [tags, setTags] = useState((initial.tags || []).join(", "));
  const [isFeatured, setFeatured] = useState(initial.isFeatured || false);
  const [isTrending, setTrending] = useState(initial.isTrending || false);
  const [validation, setValidation] = useState("");
  const [uploading, setUploading] = useState<"cover" | "audio" | null>(null);

  const pickAndUpload = async (kind: "cover" | "audio") => {
    setValidation("");
    const result = await DocumentPicker.getDocumentAsync({
      type: kind === "cover" ? ["image/jpeg", "image/png", "image/webp"] : ["audio/mpeg"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (kind === "audio" && !asset.name.toLowerCase().endsWith(".mp3")) {
      setValidation("Choose an MP3 file. M4A/DASH audio is not reliably supported on Android.");
      return;
    }
    const maxBytes = kind === "cover" ? 5 * 1024 * 1024 : 200 * 1024 * 1024;
    if (asset.size && asset.size > maxBytes) {
      setValidation(kind === "cover" ? "Cover image must be 5 MB or smaller." : "Audio file must be 200 MB or smaller.");
      return;
    }

    setUploading(kind);
    const upload = await api.upload<UploadResponse>(`/admin/uploads/${kind === "cover" ? "cover" : "audio"}`, {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || (kind === "cover" ? "image/jpeg" : "audio/mpeg"),
    });
    setUploading(null);
    if (!upload.success || !upload.data) {
      setValidation(upload.error || `Could not upload ${kind === "cover" ? "image" : "audio"}.`);
      return;
    }
    if (kind === "cover") {
      setCoverImageUrl(upload.data.media.url);
      setCoverPublicId(upload.data.media.publicId);
    } else {
      setIntroAudioUrl(upload.data.media.url);
      setIntroAudioPublicId(upload.data.media.publicId);
      setIntroAudioFileName(asset.name);
    }
  };

  const submit = () => {
    if (uploading) { setValidation("Wait for the media upload to finish."); return; }
    if (!title.trim()) { setValidation("Title is required."); return; }
    if (!description.trim()) { setValidation("Description is required."); return; }
    if (!Number.isFinite(Number(duration)) || Number(duration) < 0) {
      setValidation("Duration must be a non-negative number of seconds, for example 180.");
      return;
    }
    if (!Number.isFinite(Number(sortOrder)) || Number(sortOrder) < 0) {
      setValidation("Sort order must be a non-negative number, for example 10.");
      return;
    }
    setValidation("");
    onSubmit({ title: title.trim(), description: description.trim(), language, category, status, accessType, coverImageUrl: coverImageUrl.trim(), coverPublicId, introAudioUrl: introAudioUrl.trim(), introAudioPublicId, introAudioFileName, totalDurationSeconds: Number(duration), sortOrder: Number(sortOrder), tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), isFeatured, isTrending });
  };

  const field = (label: string, value: string, setValue: (v: string) => void, props: object = {}) => <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={setValue} placeholderTextColor="#8A817B" {...props} /></View>;
  const choice = <T extends string>(label: string, value: T, values: readonly T[], setValue: (v: T) => void) => <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.choices}>{values.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: value === item }} onPress={() => setValue(item)} style={[styles.choice, value === item && styles.choiceActive]}><Text style={[styles.choiceText, value === item && styles.choiceTextActive]}>{item}</Text></Pressable>)}</View></View>;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>EDITORIAL CONTROL</Text><Text style={styles.heading}>{initial._id ? "Edit the edition" : "Create a new edition"}</Text><Text style={styles.subhead}>Published books appear immediately in every open listener app.</Text>
    <View style={styles.section}><Text style={styles.sectionTitle}>01  Identity</Text>{field("Title *", title, setTitle, { placeholder: "Book title" })}{field("Description *", description, setDescription, { placeholder: "What listeners will discover", multiline: true, textAlignVertical: "top", style: [styles.input, styles.textarea] })}</View>
    <View style={styles.section}><Text style={styles.sectionTitle}>02  Classification</Text>{choice("Language", language, options.language, setLanguage)}{choice("Category", category, options.category, setCategory)}{field("Tags", tags, setTags, { placeholder: "calm, habits, focus" })}</View>
    <View style={styles.section}><Text style={styles.sectionTitle}>03  Media</Text>
      <Text style={styles.label}>Book cover</Text>
      {coverImageUrl ? <Image source={{ uri: coverImageUrl }} style={styles.coverPreview} contentFit="cover" /> : <View style={styles.mediaEmpty}><Text style={styles.mediaEmptyText}>No cover selected</Text></View>}
      <View style={styles.mediaActions}><Pressable disabled={Boolean(uploading)} onPress={() => pickAndUpload("cover")} style={styles.uploadButton}>{uploading === "cover" ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.uploadButtonText}>{coverImageUrl ? "Replace image" : "Choose image"}</Text>}</Pressable>{coverImageUrl ? <Pressable onPress={() => { setCoverImageUrl(""); setCoverPublicId(""); }} style={styles.removeButton}><Text style={styles.removeButtonText}>Remove</Text></Pressable> : null}</View>
      <Text style={styles.uploadHelp}>JPG, PNG or WebP · maximum 5 MB</Text>

      <Text style={[styles.label, styles.audioLabel]}>Main book audio</Text>
      <View style={styles.audioCard}><Text style={styles.audioIcon}>♪</Text><View style={styles.audioCopy}><Text style={styles.audioTitle} numberOfLines={1}>{introAudioUrl ? (introAudioFileName || "Uploaded MP3") : "No audio selected"}</Text><Text style={styles.audioMeta}>{introAudioUrl ? "Ready to save with this book" : "Select an MP3 file"}</Text></View></View>
      <View style={styles.mediaActions}><Pressable disabled={Boolean(uploading)} onPress={() => pickAndUpload("audio")} style={styles.uploadButton}>{uploading === "audio" ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.uploadButtonText}>{introAudioUrl ? "Replace audio" : "Choose audio"}</Text>}</Pressable>{introAudioUrl ? <Pressable onPress={() => { setIntroAudioUrl(""); setIntroAudioPublicId(""); setIntroAudioFileName(""); }} style={styles.removeButton}><Text style={styles.removeButtonText}>Remove</Text></Pressable> : null}</View>
      <Text style={styles.uploadHelp}>Users play this MP3 from the book page · maximum 200 MB</Text>
      {field("Duration (seconds)", duration, setDuration, { keyboardType: "numeric" })}
    </View>
    <View style={styles.section}><Text style={styles.sectionTitle}>04  Publishing</Text>{choice("Publication state", status, options.status, setStatus)}{choice("Access", accessType, options.accessType, setAccessType)}{field("Sort order", sortOrder, setSortOrder, { keyboardType: "numeric" })}<View style={styles.toggle}><View><Text style={styles.toggleTitle}>Featured</Text><Text style={styles.helper}>Show prominently on Home</Text></View><Switch value={isFeatured} onValueChange={setFeatured} trackColor={{ true: "#FF6B4A" }} /></View><View style={styles.toggle}><View><Text style={styles.toggleTitle}>Trending</Text><Text style={styles.helper}>Mark as currently popular</Text></View><Switch value={isTrending} onValueChange={setTrending} trackColor={{ true: "#FF6B4A" }} /></View></View>
    {validation || error ? <Text accessibilityRole="alert" style={styles.error}>{validation || error}</Text> : null}<Pressable accessibilityRole="button" disabled={saving || Boolean(uploading)} onPress={submit} style={[styles.save, (saving || uploading) && styles.disabled]}><Text style={styles.saveText}>{saving ? "Saving…" : uploading ? "Uploading media…" : submitLabel}</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:"#F7F3EE"},content:{padding:20,paddingBottom:50},eyebrow:{color:"#FF6B4A",fontSize:12,fontWeight:"900",letterSpacing:1.5},heading:{color:"#181818",fontSize:30,fontWeight:"900",marginTop:6},subhead:{color:"#665E58",lineHeight:21,marginTop:8,marginBottom:24},section:{backgroundColor:"#FFF",borderLeftColor:"#FF6B4A",borderLeftWidth:3,padding:16,marginBottom:14},sectionTitle:{color:"#181818",fontSize:16,fontWeight:"900",marginBottom:16},field:{marginBottom:16},label:{color:"#36302C",fontSize:13,fontWeight:"800",marginBottom:7},input:{backgroundColor:"#F8F5F1",borderColor:"#D9D1CA",borderRadius:8,borderWidth:1,color:"#181818",minHeight:48,paddingHorizontal:13,paddingVertical:11},textarea:{minHeight:110},choices:{flexDirection:"row",flexWrap:"wrap",gap:8},choice:{borderColor:"#CFC6BE",borderRadius:7,borderWidth:1,minHeight:42,justifyContent:"center",paddingHorizontal:12},choiceActive:{backgroundColor:"#181818",borderColor:"#181818"},choiceText:{color:"#4F4843",fontWeight:"700",textTransform:"capitalize"},choiceTextActive:{color:"#FFF"},toggle:{alignItems:"center",borderTopColor:"#EEE7E1",borderTopWidth:1,flexDirection:"row",gap:10,justifyContent:"space-between",minHeight:64},toggleTitle:{color:"#181818",fontWeight:"800"},helper:{color:"#756D67",fontSize:12,marginTop:3},coverPreview:{backgroundColor:"#EAE3DC",borderRadius:8,height:210,maxWidth:"100%",width:154},mediaEmpty:{alignItems:"center",backgroundColor:"#F3EEE9",borderColor:"#D9D1CA",borderRadius:8,borderStyle:"dashed",borderWidth:1,height:120,justifyContent:"center"},mediaEmptyText:{color:"#756D67",fontWeight:"700"},mediaActions:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:12},uploadButton:{alignItems:"center",backgroundColor:"#181818",borderRadius:8,justifyContent:"center",minHeight:46,minWidth:132,paddingHorizontal:16},uploadButtonText:{color:"#FFFFFF",fontWeight:"900"},removeButton:{alignItems:"center",borderColor:"#D9D1CA",borderRadius:8,borderWidth:1,justifyContent:"center",minHeight:46,paddingHorizontal:16},removeButtonText:{color:"#B42318",fontWeight:"800"},uploadHelp:{color:"#756D67",fontSize:12,marginBottom:20,marginTop:7},audioLabel:{marginTop:4},audioCard:{alignItems:"center",backgroundColor:"#F3EEE9",borderRadius:8,flexDirection:"row",gap:12,padding:14},audioIcon:{color:"#FF6B4A",fontSize:30,fontWeight:"900"},audioCopy:{flex:1,minWidth:0},audioTitle:{color:"#181818",fontWeight:"900"},audioMeta:{color:"#756D67",fontSize:12,marginTop:3},error:{color:"#B42318",fontWeight:"700",marginBottom:12},save:{alignItems:"center",backgroundColor:"#FF6B4A",borderRadius:8,minHeight:54,justifyContent:"center"},saveText:{color:"#FFF",fontSize:16,fontWeight:"900"},disabled:{opacity:.55} });
