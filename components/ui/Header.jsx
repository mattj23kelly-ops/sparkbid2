"use client";

import { useRouter } from "next/navigation";

export default function Header({ title = "SparkBid", showBack = false }) {
  const router = useRouter();
  return (
    <header className="bg-[#0F2B46] px-4 py-4 flex items-center gap-3">
      {showBack && (
        <button
          onClick={() => router.back()}
          className="text-slate-400 font-semibold text-sm mr-2"
        >
          ← Back
        </button>
      )}
      {!showBack && (
        <div className="w-7 h-7 bg-amber-400 rounded-lg flex items-center justify-center text-sm">
          ⚡
        </div>
      )}
      <span className="font-display font-black text-white text-lg">{title}</span>
    </header>
  );
}
