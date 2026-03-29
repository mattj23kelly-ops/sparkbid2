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

    // Mark this bid as awarded
    const { error: bidError } = await supabase
      .from("bids")
      .update({ status: "awarded" })
      .eq("id", bidId);

    if (bidError) {
      setError(bidError.message);
      setLoading(false);
      return;
    }

    // Mark all other bids on this project as declined
    await supabase
      .from("bids")
      .update({ status: "declined" })
      .eq("project_id", projectId)
      .neq("id", bidId);

    // Mark project as awarded
    await supabase
      .from("projects")
      .update({ status: "awarded" })
      .eq("id", projectId);

    router.refresh();
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
        {error}
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full bg-green-600 text-white font-black py-3 rounded-xl hover:bg-green-700 transition-colors text-sm"
      >
        🏆 Award Job
      </button>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
      <p className="text-green-800 font-bold text-sm text-center">
        Award this job to <strong>{contractorName}</strong> for <strong>${amount.toLocaleString()}</strong>?
      </p>
      <p className="text-green-700 text-xs text-center">
        All other bids will be declined. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 bg-white border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleAward}
          disabled={loading}
          className="flex-1 bg-green-600 text-white font-black py-2.5 rounded-xl text-sm hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {loading ? "Awarding..." : "✅ Confirm Award"}
        </button>
      </div>
    </div>
  );
}
