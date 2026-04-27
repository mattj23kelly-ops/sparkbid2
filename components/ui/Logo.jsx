import Link from "next/link";

export default function Logo({ href = "/", size = "md" }) {
  const sizes = {
    sm: { box: "w-7 h-7", text: "text-base", icon: "text-sm" },
    md: { box: "w-8 h-8", text: "text-lg",  icon: "text-base" },
    lg: { box: "w-10 h-10", text: "text-xl", icon: "text-lg" },
  }[size];

  return (
    <Link href={href} className="flex items-center gap-2 group">
      <span
        className={`${sizes.box} rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm group-hover:shadow-pop transition-shadow`}
        aria-hidden
      >
        <span className={`${sizes.icon} text-white font-black`}>⚡</span>
      </span>
      <span className={`${sizes.text} font-bold tracking-tight text-slate-900`}>
        SparkBid
      </span>
    </Link>
  );
}
