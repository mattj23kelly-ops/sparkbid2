import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import VerificationActions from "@/components/ui/VerificationActions";

export const dynamic = "force-dynamic";

export default async function VerificationsPage() {
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, license_number, location, specialties, verification_status, verification_notes, created_at")
    .eq("role", "ec")
    .in("verification_status", ["pending", "rejected"])
    .order("created_at", { ascending: true });

  const { data: approved } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, license_number, verified_at")
    .eq("role", "ec")
    .eq("verification_status", "approved")
    .order("verified_at", { ascending: false })
    .limit(20);

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title="License verifications"
        subtitle={`${pending?.length ?? 0} awaiting review`}
      />

      {(!pending || pending.length === 0) ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="font-semibold text-slate-900">No pending verifications</p>
          <p className="text-sm text-slate-500 mt-1">You&apos;re all caught up.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 truncate">
                      {p.company_name ?? p.full_name ?? "Unnamed"}
                    </h3>
                    <StatusChip status={p.verification_status} />
                  </div>
                  <p className="text-sm text-slate-500">
                    {p.full_name}
                    {p.location ? ` · ${p.location}` : ""}
                  </p>
                </div>
                <p className="text-xs text-slate-400 shrink-0">
                  Submitted {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>

              <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">License number</dt>
                  <dd className="font-mono text-slate-900 mt-0.5">
                    {p.license_number ?? <span className="text-slate-400 italic">Not provided</span>}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-xs text-slate-500">Specialties</dt>
                  <dd className="text-slate-900 mt-0.5">
                    {p.specialties?.length
                      ? p.specialties.join(", ")
                      : <span className="text-slate-400 italic">None listed</span>}
                  </dd>
                </div>
              </dl>

              {p.verification_notes && (
                <div className="mb-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold mr-2">Previous note</span>
                  {p.verification_notes}
                </div>
              )}

              <VerificationActions profileId={p.id} />
            </div>
          ))}
        </div>
      )}

      {/* Recently approved */}
      {approved && approved.length > 0 && (
        <div className="mt-12">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Recently approved
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {approved.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-slate-900 text-sm">
                    {p.company_name ?? p.full_name ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{p.license_number}</p>
                </div>
                <p className="text-xs text-slate-400">
                  {p.verified_at ? new Date(p.verified_at).toLocaleDateString() : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    pending:  { label: "Pending", cls: "bg-amber-100 text-amber-800" },
    rejected: { label: "Needs attention", cls: "bg-red-100 text-red-800" },
    approved: { label: "Approved", cls: "bg-green-100 text-green-800" },
  };
  const m = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>
      {m.label}
    </span>
  );
}
