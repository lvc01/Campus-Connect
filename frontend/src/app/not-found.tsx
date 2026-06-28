import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Compass className="h-8 w-8" />
      </div>
      <p className="text-sm font-bold uppercase tracking-widest text-text-secondary">404</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-foreground transition hover:opacity-90 active:scale-95"
      >
        Back to feed
      </Link>
    </div>
  );
}
