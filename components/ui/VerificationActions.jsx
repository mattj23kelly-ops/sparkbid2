"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerificationActions({ profileId }) {
  const router = useRouter();
  const [mode, setMode] = useState(null);    // null | 'approve' | 'reject'
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(decision) {
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, decision, notes: notes || null }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    setLoading(false);
    setMode(null);
    setNotes("");
    router.refresh();
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (mode === "reject") {
    return (
      <div className="space-y-3">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Why is this being rejected? (shown to the contractor)"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex gap-2">
          <button
            onClick={() => { setMode(null); setNotes(""); }}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => submit("reject")}
            disabled={loading || !notes.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Rejecting…" : "Confirm reject"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => submit("approve")}
        disabled={loading}
        className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
      >
        {loading ? "Approving…" : "Approve"}
      </button>
      <button
        onClick={() => setMode("reject")}
        className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Reject
      </button>
    </div>
  );
}
