"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AwardButton({ bidId, projectId, contractorName, amount }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAward() {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { error: bidError } = await supabase
      .from("bids")
      .update({ status: "awarded" })
      .eq("id", bidId);

    if (bidError) {
      setError(bidError.message);
      setLoading(false);
      return;
    }

    await supabase
      .from("bids")
      .update({ status: "declined" })
      .eq("project_id", projectId)
      .neq("id", bidId);

    await supabase
      .from("projects")
      .update({ status: "awarded" })
      .eq("id", projectId);

    // Fire-and-forget: notify the winning EC.
    fetch("/api/notifications/bid-awarded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bidId }),
    }).catch((e) => console.warn("Notification dispatch failed:", e));

    router.refresh();
  }

  if (error) {
    return (
      <div className="card p-3 bg-red-50 border-red-100 text-sm text-red-700">{error}</div>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn w-full bg-green-600 hover:bg-green-700 text-white"
      >
        Award job
      </button>
    );
  }

  return (
    <div className="card p-4 bg-green-50 border-green-100 space-y-3">
      <p className="text-sm text-green-800 text-center">
        Award this job to <strong>{contractorName}</strong> for{" "}
        <strong className="tabular-nums">${amount.toLocaleString()}</strong>?
      </p>
      <p className="text-xs text-green-700 text-center">
        All other bids will be declined. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="btn btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          onClick={handleAward}
          disabled={loading}
          className="btn flex-1 bg-green-600 hover:bg-green-700 text-white"
        >
          {loading ? "Awarding…" : "Confirm award"}
        </button>
      </div>
    </div>
  );
}
