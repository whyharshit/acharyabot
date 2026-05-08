"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { t } from "@/lib/i18n/labels";
import { useStore } from "@/lib/store";

export default function StartPage() {
  const { lang } = useStore();
  const copy = {
    bn: {
      tag: "ইলেকট্রিশিয়ান ট্রেনিং",
      subtitle: "হেল্পার ও শিক্ষানবিশদের জন্য নিরাপত্তা-প্রথম ইলেকট্রিক্যাল শেখা।",
      learnTitle: "আপনি যা শিখবেন",
      learnText: "ইলেকট্রিক্যাল সেফটি, টুলস, তার, সুইচবোর্ড, MCB ও RCCB বেসিক, আর্থিং, লোড ক্যালকুলেশন, ফল্ট খোঁজা এবং পেশাদার কাস্টমার ভিজিট শিখুন।",
      start: "শেখা শুরু করুন",
      features: [
        ["Courses", "Supabase-এ রাখা সাজানো মডিউল।"],
        ["জিজ্ঞাসা", "টেক্সট, ভয়েস বা ছবি দিয়ে Vajra Acharya-কে প্রশ্ন করুন।"],
        ["কুইজ", "Gemini দিয়ে ব্যবহারিক ইলেকট্রিক্যাল কুইজ তৈরি করুন।"],
        ["অগ্রগতি", "সম্পন্ন সেকশন ও কুইজ চেষ্টা ট্র্যাক করুন।"],
      ],
    },
    hi: {
      tag: "इलेक्ट्रीशियन ट्रेनिंग",
      subtitle: "हेल्पर और अप्रेंटिस के लिए सुरक्षा-प्रथम इलेक्ट्रिकल सीखना।",
      learnTitle: "आप क्या सीखेंगे",
      learnText: "इलेक्ट्रिकल सुरक्षा, टूल्स, वायर, स्विचबोर्ड, MCB और RCCB बेसिक्स, अर्थिंग, लोड कैलकुलेशन, फॉल्ट फाइंडिंग और प्रोफेशनल ग्राहक विज़िट सीखें।",
      start: "सीखना शुरू करें",
      features: [
        ["Courses", "Supabase में रखे व्यवस्थित मॉड्यूल।"],
        ["पूछें", "टेक्स्ट, वॉइस या इमेज से Vajra Acharya से सवाल पूछें।"],
        ["क्विज़", "Gemini से व्यावहारिक इलेक्ट्रिकल क्विज़ बनाएं।"],
        ["प्रगति", "पूरे सेक्शन और क्विज़ प्रयास ट्रैक करें।"],
      ],
    },
    en: {
      tag: "Electrician Training",
      subtitle: "Safety-first electrical learning for helpers and apprentices.",
      learnTitle: "What you will learn",
      learnText: "Learn electrical safety, tools, wires, switchboards, MCB and RCCB basics, earthing, load calculation, fault finding, and professional customer visits.",
      start: "Start learning",
      features: [
        ["Courses", "Structured modules stored in Supabase."],
        ["Ask", "Ask Vajra Acharya questions with text, voice, or image."],
        ["Quiz", "Generate practical electrical quizzes with Gemini."],
        ["Progress", "Track completed sections and quiz attempts."],
      ],
    },
  } as const;
  const c = copy[lang];

  return (
    <main className="min-h-screen bg-paper">
      <section className="max-w-4xl mx-auto px-5 py-10 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar size={72} useImage />
          <div>
            <Tag tone="gold">{c.tag}</Tag>
            <h1 className="font-serif italic text-4xl text-ink mt-2">{t("appName", lang)}</h1>
            <p className="text-sm text-muted mt-1">{c.subtitle}</p>
          </div>
        </div>

        <Card tone="forest" padding="lg">
          <h2 className="font-serif italic text-2xl text-cream">{c.learnTitle}</h2>
          <p className="text-cream/85 text-sm leading-relaxed mt-3">
            {c.learnText}
          </p>
        </Card>

        <div className="grid md:grid-cols-2 gap-3">
          <Feature icon="book" title={c.features[0][0]} text={c.features[0][1]} />
          <Feature icon="chat" title={c.features[1][0]} text={c.features[1][1]} />
          <Feature icon="quiz" title={c.features[2][0]} text={c.features[2][1]} />
          <Feature icon="chart" title={c.features[3][0]} text={c.features[3][1]} />
        </div>

        <Link
          href="/learn"
          className="inline-flex items-center gap-2 bg-forest text-cream hover:bg-forest-deep transition-colors rounded-full px-5 py-3 text-sm font-semibold"
        >
          {c.start}
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


