"use client";

export function AuthRequired({ onLogin, onCreateAccount }: { onLogin: () => void; onCreateAccount: () => void }) {
  return <main className="flex min-h-[calc(100vh-2rem)] items-center justify-center bg-[#0d0d0d] px-5 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171717] p-7 text-center shadow-2xl"><img src="/happinotes-logo.png" alt="HappiNotes" className="mx-auto h-20 w-auto object-contain" /><h1 className="mt-5 text-2xl font-bold">Welcome to HappiNotes</h1><p className="mt-2 text-sm leading-6 text-white/60">Login or create an account to discover and listen to story books.</p><button type="button" onClick={onLogin} className="mt-6 w-full rounded-xl bg-[#ff735f] px-4 py-3 font-semibold text-white">Login</button><button type="button" onClick={onCreateAccount} className="mt-3 text-sm text-white/65 hover:text-white">New to HappiNotes? Create account</button></section></main>;
}
