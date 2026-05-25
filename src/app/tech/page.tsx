import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vajra Acharya - Technical Architecture",
};

export default function TechPage() {
  return (
    <main className="min-h-screen bg-paper text-ink px-5 py-10">
      <section className="max-w-3xl mx-auto space-y-5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Technical Notes</p>
        <h1 className="font-serif italic text-4xl">Vajra Acharya</h1>
        <p className="text-muted leading-relaxed">
          The app uses Next.js route handlers as the backend-for-frontend, Supabase for course and learner data,
          and Gemini for chat, image guidance, and quiz generation.
        </p>
        <ul className="space-y-2 text-sm">
          <li>Courses: `/api/content/modules` and `/api/content/sections`</li>
          <li>Ask and image guidance: `/api/chat`</li>
          <li>Quiz generation: `/api/quiz`</li>
          <li>Progress: `/api/learner/progress`</li>
          <li>Login: `/api/auth/phone/*` with pilot OTP `123456`</li>
        </ul>
        <Link href="/" className="inline-flex text-forest font-semibold hover:underline">
          Back to app
        </Link>
      </section>
    </main>
  );
}


