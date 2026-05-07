"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";

export default function StartPage() {
  return (
    <main className="min-h-screen bg-paper">
      <section className="max-w-4xl mx-auto px-5 py-10 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar size={72} useImage />
          <div>
            <Tag tone="gold">Electrician Training</Tag>
            <h1 className="font-serif italic text-4xl text-ink mt-2">Vajra Acharya</h1>
            <p className="text-sm text-muted mt-1">Safety-first electrical learning for helpers and apprentices.</p>
          </div>
        </div>

        <Card tone="forest" padding="lg">
          <h2 className="font-serif italic text-2xl text-cream">What you will learn</h2>
          <p className="text-cream/85 text-sm leading-relaxed mt-3">
            Learn electrical safety, tools, wires, switchboards, MCB and RCCB basics, earthing,
            load calculation, fault finding, and professional customer visits.
          </p>
        </Card>

        <div className="grid md:grid-cols-2 gap-3">
          <Feature icon="book" title="Courses" text="Structured modules stored in Supabase." />
          <Feature icon="chat" title="Ask" text="Ask Vajra Acharya questions with text, voice, or image." />
          <Feature icon="quiz" title="Quiz" text="Generate practical electrical quizzes with Gemini." />
          <Feature icon="chart" title="Progress" text="Track completed sections and quiz attempts." />
        </div>

        <Link
          href="/learn"
          className="inline-flex items-center gap-2 bg-forest text-cream hover:bg-forest-deep transition-colors rounded-full px-5 py-3 text-sm font-semibold"
        >
          Start learning
          <Icon name="arrowR" size={16} />
        </Link>
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: "book" | "chat" | "quiz" | "chart"; title: string; text: string }) {
  return (
    <Card tone="surface" padding="lg">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-sage flex items-center justify-center text-forest shrink-0">
          <Icon name={icon} size={20} />
        </div>
        <div>
          <h3 className="font-serif text-lg text-ink">{title}</h3>
          <p className="text-sm text-muted mt-1">{text}</p>
        </div>
      </div>
    </Card>
  );
}


