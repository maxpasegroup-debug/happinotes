"use client";

import { useParams } from "next/navigation";
import BookEditor from "@/components/admin/BookEditor";

export default function EditBookPage() {
  const params = useParams<{ id: string }>();
  return <BookEditor contentId={params.id} />;
}
