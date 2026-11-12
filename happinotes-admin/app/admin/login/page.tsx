"use client";

import { AdminButton, AdminInput } from "@/components/admin/ui";
import { AdminInstallButton } from "@/components/admin/AdminPwaProvider";

import { Card, CardBody, Chip, Divider } from "@heroui/react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type Payload = { token?: string; user?: { role?: string }; message?: string };

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!email.trim() || !password) throw new Error("Enter the admin email and password.");
      const data = await apiRequest<Payload>("/auth/login", "POST", {
        email: email.trim().toLowerCase(), password,
      });
      if (!data?.token || data.user?.role !== "admin") {
        throw new Error(data?.message || "Only the configured administrator can access this website.");
      }
      window.localStorage.setItem("admin_token", data.token);
      router.replace("/admin/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-divider bg-content1 p-14 lg:flex">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="relative flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-xl font-bold">h.</span><p className="text-xl font-bold tracking-tight">HappiNotes</p></div>
        <div className="relative max-w-md"><Chip color="primary" variant="flat" size="sm">A little inspiration, every day</Chip><h1 className="mt-7 !text-5xl !leading-[1.12]">Good stories.<br /><span className="text-primary">Meaningful moments.</span></h1><p className="mt-6 text-base leading-7 text-default-400">Your space to bring audiobooks, thoughtful Happy Bites, and positive ideas to the HappiNotes community.</p><Divider className="my-8" /><p className="text-xs uppercase tracking-[.16em] text-default-500">The HappiNotes admin workspace</p></div>
        <p className="relative text-xs text-default-500">Content that makes a difference.</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md border border-divider bg-content1/60" shadow="sm" radius="lg"><CardBody className="p-7 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">HappiNotes Studio</p>
          <h1 className="mt-3">Welcome back</h1>
          <p className="mt-3 text-sm leading-6 text-default-400">Sign in to manage books, episodes, users, and notifications.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block text-sm font-medium text-default-500" htmlFor="admin-email">Admin email
              <AdminInput id="admin-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" placeholder="Enter your admin email" className="mt-2" />
            </label>
            <label className="block text-sm font-medium text-default-500" htmlFor="admin-password">Password
              <AdminInput id="admin-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Enter admin password" className="mt-2" />
            </label>
            {error ? <p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger-300">{error}</p> : null}
            <AdminButton type="submit" disabled={loading} isLoading={loading} color="primary" variant="solid" className="mt-2 w-full min-h-12">{loading ? "Signing in..." : "Admin login"}</AdminButton>
          </form>
          <div className="mt-4 flex justify-center"><AdminInstallButton /></div>
        </CardBody></Card>
      </section>
    </main>
  );
}
