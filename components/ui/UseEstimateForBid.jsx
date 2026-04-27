"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Button that opens a picker of open marketplace projects.
 * Selecting one routes to /bid/{projectId}?estimateId={estimateId}
 * so the bid page can pre-fill from the estimate.
 *
 * Props:
 *   estimateId — the estimate this will seed the bid from.
 *   projects   — [{ id, title, location, project_type, budget_max, bid_deadline }]
 *   canBid     — boolean: whether the EC is verified (approved). If false we
 *                disable the button and show a hint.
 */
export default function UseEstimateForBid({ estimateId, projects, canBid }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!canBid) {
    return (
      <div className="mt-3 text-xs text-slate-500">
        Get your license verified to use this estimate on a bid.{" "}
        <Link href="/profile/edit" className="underline hover:text-slate-700">
          Update license
        </Link>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="mt-3 text-xs text-slate-500">
        No open projects matched. <Link href="/browse" className="underline hover:text-slate-700">Browse the marketplace →</Link>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-primary w-full mt-3"
      >
        Use this estimate on a bid →
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Pick a project to bid on</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  We&apos;ll pre-fill the bid with this estimate&apos;s totals.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/bid/${p.id}?estimateId=${estimateId}&mode=manual`);
                  }}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <p className="font-semibold text-slate-900 truncate">{p.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.location}
                    {p.project_type ? ` · ${p.project_type}` : ""}
                    {p.budget_max ? ` · up to $${Number(p.budget_max).toLocaleString()}` : ""}
                  </p>
                  {p.bid_deadline && (
                    <p className="text-xs text-amber-700 mt-1">
                      Bids close {new Date(p.bid_deadline).toLocaleDateString()}
                    </p>
                  )}
                </button>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <Link
                href="/browse"
                className="text-xs text-slate-600 hover:text-slate-900 underline"
              >
                See the full marketplace →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
