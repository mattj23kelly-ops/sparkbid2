// Root page: redirects authenticated users to their dashboard; otherwise
// shows the estimator-first marketing landing.
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/ui/Logo";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "gc") redirect("/gc");
    redirect("/ec");
  }

  return (
    <main className="min-h-screen bg-white">
      {/* ── Nav ── */}
      <header className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <Logo size="md" />
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn btn-ghost">Log in</Link>
            <Link href="/signup" className="btn btn-primary">Sign up</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="chip bg-brand-100 text-brand-700 mb-5">For electrical contractors</span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
              Estimate electrical jobs in <span className="text-brand-600">minutes</span>, not days.
            </h1>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-xl">
              Upload a plan sheet. SparkBid&apos;s AI counts devices, fixtures, and panels,
              calculates conduit and wire, and produces a priced estimate you can review
              and send — from your own catalog, not a black box.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/signup" className="btn btn-primary !py-3 !px-5 text-base">
                Start estimating free
              </Link>
              <Link href="#how" className="btn btn-secondary !py-3 !px-5 text-base">
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              No credit card required · Works with PDF, PNG, JPG
            </p>
          </div>

          <div className="relative">
            {/* Decorative mock of the estimator UI */}
            <div className="card p-5 shadow-pop rotate-[-1deg]">
              <div className="flex items-center justify-between mb-3">
                <span className="chip bg-brand-100 text-brand-700">AI Take-off</span>
                <span className="text-xs text-slate-400">87% confidence</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 mb-3">Office Building Rewire — 3rd Floor</p>
              <div className="space-y-2">
                <MockRow label="Duplex Receptacle 120V" qty="42 ea" price="$147" />
                <MockRow label="GFCI Receptacle"        qty="6 ea"  price="$102" />
                <MockRow label="LED 2x4 Troffer"        qty="18 ea" price="$1,404" />
                <MockRow label="200A Main Panel"        qty="1 ea"  price="$320" />
                <MockRow label={'EMT 3/4"'}             qty="800 ft" price="$1,000" />
                <MockRow label="#12 THHN CU"            qty="3,200 ft" price="$1,216" />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm text-slate-600">Grand total</span>
                <span className="text-2xl font-bold tabular-nums">$47,280</span>
              </div>
            </div>
            {/* Floating accent */}
            <div className="hidden md:block absolute -bottom-4 -right-4 card p-4 shadow-pop rotate-[3deg] w-64">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Saved vs. manual</p>
              <p className="text-3xl font-bold text-brand-600 mt-1">4.5 hrs</p>
              <p className="text-xs text-slate-500 mt-1">avg. per bid</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">From plans to priced estimate in 4 steps.</h2>
            <p className="text-slate-600 mt-3">Built by estimators, tuned on real electrical take-offs. You&apos;re always in control of the numbers.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card p-6">
                <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-slate-900 mt-4">{s.title}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section className="border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Why estimators use SparkBid.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6">
                <h3 className="font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Marketplace teaser ── */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-16">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="chip bg-amber-100 text-amber-800 mb-4">Coming alongside</span>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Connect with GCs without leaving the tool.</h2>
              <p className="text-slate-600 mt-3 leading-relaxed max-w-lg">
                Once your estimate is ready, send it to a GC with one click. We&apos;re also building a marketplace of open projects — but you don&apos;t need it to get value. Estimate first; bid when you&apos;re ready.
              </p>
            </div>
            <div className="card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Open projects · preview</p>
              <ul className="mt-3 space-y-2">
                {PROJECT_SAMPLES.map((p) => (
                  <li key={p.title} className="flex items-center justify-between py-2 border-t border-slate-100 first:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{p.title}</p>
                      <p className="text-xs text-slate-500">{p.location} · {p.type}</p>
                    </div>
                    <span className="text-sm font-semibold text-brand-700 tabular-nums">{p.budget}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-6 md:px-8 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Stop losing nights to take-offs.</h2>
          <p className="text-slate-600 mt-3">Sign up free. Upload your first plan and have a priced estimate in 5 minutes.</p>
          <Link href="/signup" className="btn btn-primary mt-6 !py-3 !px-6 text-base inline-flex">Get started</Link>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-14 flex items-center justify-between text-xs text-slate-500">
          <p>© SparkBid · For electrical contractors</p>
          <p>Built with AI take-offs</p>
        </div>
      </footer>
    </main>
  );
}

function MockRow({ label, qty, price }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-700">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 tabular-nums">{qty}</span>
        <span className="font-medium text-slate-900 tabular-nums w-16 text-right">{price}</span>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Upload plans",      body: "Drop any PDF, PNG, or JPG plan sheet. Whole set, single page, or a partial scan — whatever you have." },
  { title: "AI take-off",       body: "SparkBid counts devices, fixtures, and panels, and estimates conduit/wire runs. Every count is editable." },
  { title: "Price from catalog",body: "Unit pricing pulled from your own catalog. Materials, labor hours, overhead, profit, and contingency computed automatically." },
  { title: "Save and share",    body: "Keep estimates organized, duplicate for similar jobs, and send to the GC. Won/lost tracking included." },
];

const FEATURES = [
  { title: "Your catalog, not ours",
    body: "Start with industry defaults, then override every unit price for the parts and labor rates you actually use. Never locked into someone else's numbers." },
  { title: "AI flags what it can't see",
    body: "Confidence scores and plain-English notes on every take-off — 'Panel schedule not legible on sheet E2.1' — so you know where to double-check." },
  { title: "Materials + labor + O&P, separated",
    body: "See the breakdown by category and by line. Adjust overhead, profit, and contingency independently to match your internal math." },
  { title: "Edit everything",
    body: "Counts, prices, labor hours, descriptions — every cell is editable. AI gets you 80% of the way; your expertise closes the gap." },
  { title: "Built for the field",
    body: "Responsive layout works from a phone in a truck. No Java, no server install, no five-year learning curve." },
  { title: "Works with what you have",
    body: "No BIM required. Sketches, marked-up PDFs, floor plans — if you can read it, we can start from it." },
];

const PROJECT_SAMPLES = [
  { title: "Office Building Rewire",   location: "Albany, NY",   type: "Commercial",   budget: "$45k–65k" },
  { title: "Solar + Battery Install",  location: "Westchester",  type: "Residential",  budget: "$18k–25k" },
  { title: "Warehouse LED Retrofit",   location: "Syracuse, NY", type: "Industrial",   budget: "$72k–90k" },
];
