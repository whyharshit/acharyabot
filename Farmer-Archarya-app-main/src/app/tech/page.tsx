import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";

export const metadata = {
  title: "Farmer Acharya - Technical Architecture",
  description: "Architecture notes for the Farmer Acharya farming mentor app",
};

export default function TechPage() {
  return (
    <main className="min-h-screen bg-paper px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-4">
          <Avatar size={72} useImage />
          <div>
            <Tag tone="gold" filled>Technical Notes</Tag>
            <h1 className="font-serif italic text-4xl text-forest mt-2">Farmer Acharya</h1>
            <p className="text-sm text-muted mt-1">Next.js, Supabase, AI chat, quiz, voice, progress, and admin.</p>
          </div>
        </div>

        <Card tone="cream" padding="lg">
          <h2 className="font-serif italic text-2xl text-forest">Architecture</h2>
          <p className="text-sm text-ink mt-2 leading-relaxed">
            Farmer Acharya follows the Gurukul app pattern: client state in Zustand, browser calls through API routes, server routes talk to Supabase, and the AI identity lives in a central system prompt.
          </p>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Info title="Content" body="Modules, sections, videos, and config will live in acharya_farmer once Supabase is ready." />
          <Info title="Identity" body="Phone OTP login uses the shared Gurukul user model and a signed Farmer Acharya learner cookie." />
          <Info title="AI" body="Chat uses Farmer Acharya's farming prompt, strict language rules, and optional image input for crop questions." />
          <Info title="Memory" body="Local progress and chat history persist in the browser; server logs capture progress, quiz, chat, events, and apply reports." />
        </div>

        <Link href="/" className="inline-flex bg-forest text-cream rounded-full px-4 py-2 text-sm font-semibold">
          Open app
        </Link>
      </div>
    </main>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <Card tone="surface" padding="lg">
      <h3 className="font-serif italic text-xl text-forest">{title}</h3>
      <p className="text-sm text-muted mt-2 leading-relaxed">{body}</p>
    </Card>
  );
}
