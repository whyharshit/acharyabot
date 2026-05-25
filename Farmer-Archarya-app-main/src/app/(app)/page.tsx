'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n/labels';
import { getTitle } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Icon, type IconName } from '@/components/ui/Icon';

const copy = {
  en: {
    greeting: 'Welcome back',
    prompt: 'What farming decision do you want to improve today?',
    continue: 'Continue learning',
    fieldFocus: "Today's Field Focus",
    focus: ['Soil', 'Water', 'Pest check', 'Profit'],
    want: 'What do you want to do?',
    desc: {
      learn: 'Read practical modules before field work.',
      ask: 'Ask Farmer Acharya by text, voice, or crop photo.',
      quiz: 'Check your understanding with 5 quick questions.',
      apply: 'Record what you did in the field today.',
      progress: 'modules · quizzes · avg',
    },
    plan: 'Next Upgrade Plan',
    profile: ['Farmer profile', 'Next step: save crop, state, soil, irrigation, and farm size so answers become personal.'],
    photo: ['Photo diagnosis', 'The chat route already supports images. We will tune the UI and safety copy for crop photos.'],
    diary: ['Farm diary', 'Apply logs can become a crop diary with cost, observation, photo, and next reminder.'],
    first: 'First time here?',
    firstDesc: 'Open the orientation page to understand the learning path, language choices, and safe farming advice rules.',
    open: 'Open',
  },
  hi: {
    greeting: 'नमस्ते',
    prompt: 'आज खेती के किस फैसले को बेहतर करना है?',
    continue: 'जारी रखें',
    fieldFocus: 'आज का खेत फोकस',
    focus: ['मिट्टी', 'पानी', 'कीट जांच', 'लाभ'],
    want: 'आप क्या करना चाहते हैं?',
    desc: {
      learn: 'खेत के काम से पहले उपयोगी मॉड्यूल पढ़ें।',
      ask: 'फार्मर आचार्य से टेक्स्ट, आवाज या फोटो से पूछें।',
      quiz: '5 छोटे सवालों से अपनी समझ जांचें।',
      apply: 'आज खेत में क्या किया, रिकॉर्ड करें।',
      progress: 'मॉड्यूल · क्विज · औसत',
    },
    plan: 'अगला सुधार प्लान',
    profile: ['किसान प्रोफाइल', 'अगला कदम: फसल, राज्य, मिट्टी, सिंचाई और खेत का आकार सेव करें ताकि जवाब व्यक्तिगत हों।'],
    photo: ['फोटो जांच', 'चैट रूट तस्वीरें समझता है। अब फसल फोटो के लिए UI और सुरक्षा कॉपी सुधारी जाएगी।'],
    diary: ['खेत डायरी', 'Apply logs को खर्च, अवलोकन, फोटो और अगले रिमाइंडर वाली फसल डायरी बनाया जा सकता है।'],
    first: 'पहली बार आए हैं?',
    firstDesc: 'सीखने का रास्ता, भाषा विकल्प और सुरक्षित खेती सलाह समझने के लिए ओरिएंटेशन खोलें।',
    open: 'खोलें',
  },
  bn: {
    greeting: 'নমস্কার',
    prompt: 'আজ চাষের কোন সিদ্ধান্তটা ভাল করতে চান?',
    continue: 'চালিয়ে যান',
    fieldFocus: 'আজকের মাঠের ফোকাস',
    focus: ['মাটি', 'জল', 'পোকা দেখা', 'লাভ'],
    want: 'আপনি কী করতে চান?',
    desc: {
      learn: 'মাঠের কাজের আগে ব্যবহারিক মডিউল পড়ুন।',
      ask: 'ফার্মার আচার্যকে টেক্সট, ভয়েস বা ছবি দিয়ে জিজ্ঞাসা করুন।',
      quiz: '৫টি ছোট প্রশ্নে আপনার বোঝা যাচাই করুন।',
      apply: 'আজ মাঠে কী করেছেন, রেকর্ড করুন।',
      progress: 'মডিউল · কুইজ · গড়',
    },
    plan: 'পরবর্তী উন্নতি পরিকল্পনা',
    profile: ['কৃষক প্রোফাইল', 'পরের ধাপ: ফসল, রাজ্য, মাটি, সেচ ও জমির মাপ সেভ করুন যাতে উত্তর ব্যক্তিগত হয়।'],
    photo: ['ছবি পরীক্ষা', 'চ্যাট রুট ছবি সমর্থন করে। এখন ফসলের ছবির UI ও নিরাপত্তা লেখা উন্নত করা হবে।'],
    diary: ['খামার ডায়েরি', 'Apply logs-কে খরচ, পর্যবেক্ষণ, ছবি ও পরের রিমাইন্ডারসহ ফসল ডায়েরি করা যাবে।'],
    first: 'প্রথমবার এসেছেন?',
    firstDesc: 'শেখার পথ, ভাষা পছন্দ এবং নিরাপদ চাষের পরামর্শ বুঝতে ওরিয়েন্টেশন খুলুন।',
    open: 'খুলুন',
  },
} as const;

export default function HomeDashboard() {
  const { lang, modules, selectedModuleId, progress, quizAttempts } = useStore();
  const c = copy[lang];

  const currentModule = modules.find((m) => m.id === selectedModuleId);
  const currentProgress = progress[selectedModuleId];
  const sectionsDone = currentProgress?.sections_completed?.length || 0;
  const completedModules = Object.values(progress).filter((p) => p.completed).length;
  const totalModules = modules.length || 25;
  const totalQuizzes = quizAttempts.length;
  const avgScore = totalQuizzes > 0
    ? Math.round(quizAttempts.reduce((sum, q) => sum + (q.score / q.total) * 100, 0) / totalQuizzes)
    : 0;

  const today = new Date().toLocaleDateString(lang === 'bn' ? 'bn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long', day: 'numeric', month: 'short',
  });

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-5 space-y-5">
      <Card tone="forest" padding="lg" className="relative overflow-hidden">
        <div className="absolute -right-6 -top-6 opacity-10 pointer-events-none">
          <Avatar size={140} useImage />
        </div>
        <div className="relative">
          <Tag tone="cream" className="text-gold-soft">{today}</Tag>
          <h1 className="font-serif italic text-3xl lg:text-4xl mt-2 text-cream">
            {c.greeting}
          </h1>
          <p className="text-cream/80 text-sm mt-2 max-w-md">
            {c.prompt}
          </p>
        </div>
      </Card>

      {currentModule && (
        <Link href="/learn" className="block">
          <Card tone="cream" padding="lg" className="hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-sage flex items-center justify-center text-forest shrink-0">
                <Icon name="book" size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <Tag tone="muted">{c.continue}</Tag>
                <h3 className="font-serif italic text-xl text-ink mt-1 leading-tight truncate">
                  {getTitle(currentModule, lang)}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <Tag tone="muted">{selectedModuleId}</Tag>
                  {sectionsDone > 0 && (
                    <Tag tone="forest" filled>
                      {sectionsDone} {t('sections', lang).toLowerCase()} {t('completed', lang).toLowerCase()}
                    </Tag>
                  )}
                </div>
              </div>
              <Icon name="arrowR" size={20} className="text-forest shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>
      )}

      <section>
        <Tag tone="muted" className="block mb-3">
          {c.fieldFocus}
        </Tag>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <FocusCard num="01" label={c.focus[0]} />
          <FocusCard num="02" label={c.focus[1]} />
          <FocusCard num="03" label={c.focus[2]} />
          <FocusCard num="04" label={c.focus[3]} />
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 space-y-2.5">
          <Tag tone="muted" className="block">
            {c.want}
          </Tag>
          <BriefLink href="/learn" icon="book" title={t('learn', lang)} desc={c.desc.learn} />
          <BriefLink href="/ask" icon="chat" title={t('ask', lang)} desc={c.desc.ask} />
          <BriefLink href="/quiz" icon="quiz" title={t('quiz', lang)} desc={c.desc.quiz} />
          <BriefLink href="/apply" icon="hand" title={t('apply', lang)} desc={c.desc.apply} />
          <BriefLink href="/progress" icon="chart" title={t('me', lang)} desc={`${completedModules}/${totalModules} ${c.desc.progress} · ${totalQuizzes} · ${avgScore || 0}%`} />
        </section>

        <section className="space-y-2.5">
          <Tag tone="muted" className="block">{c.plan}</Tag>
          <Card tone="surface" padding="md">
            <h3 className="font-serif italic text-lg text-forest">{c.profile[0]}</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">{c.profile[1]}</p>
          </Card>
          <Card tone="surface" padding="md">
            <h3 className="font-serif italic text-lg text-forest">{c.photo[0]}</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">{c.photo[1]}</p>
          </Card>
          <Card tone="surface" padding="md">
            <h3 className="font-serif italic text-lg text-forest">{c.diary[0]}</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">{c.diary[1]}</p>
          </Card>
        </section>
      </div>

      <Card tone="paper" padding="lg" className="border-dashed">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-gold-soft flex items-center justify-center text-forest shrink-0">
            <Icon name="sparkle" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-serif italic text-lg text-ink leading-tight">{c.first}</h4>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {c.firstDesc}
            </p>
          </div>
          <Link href="/start" className="inline-flex items-center gap-2 bg-forest text-cream hover:bg-forest-deep transition-colors rounded-full px-4 py-2 text-xs font-semibold shrink-0">
            {c.open}
            <Icon name="arrowR" size={14} />
          </Link>
        </div>
      </Card>
    </div>
  );
}

function FocusCard({ num, label }: { num: string; label: string }) {
  return (
    <Card tone="surface" padding="md" className="text-center">
      <div className="font-serif italic text-2xl lg:text-3xl text-forest leading-none">{num}</div>
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted mt-2">{label}</div>
    </Card>
  );
}

function BriefLink({
  href, icon, title, desc,
}: { href: string; icon: IconName; title: string; desc: string }) {
  return (
    <Link href={href} className="block group">
      <Card tone="surface" padding="md" className="hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-sage flex items-center justify-center text-forest shrink-0">
            <Icon name={icon} size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-serif text-base text-ink leading-tight">{title}</h4>
            <p className="text-[12.5px] text-muted leading-snug mt-0.5">{desc}</p>
          </div>
          <Icon name="arrowR" size={16} className="text-muted shrink-0 group-hover:text-forest group-hover:translate-x-1 transition-all" />
        </div>
      </Card>
    </Link>
  );
}
