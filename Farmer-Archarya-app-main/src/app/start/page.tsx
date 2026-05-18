'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import type { Lang } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Icon, type IconName } from '@/components/ui/Icon';

const copy = {
  en: {
    home: 'Home',
    appName: 'Farmer Acharya',
    tagline: 'Practical Farming Mentor',
    hero: 'Crop learning, field questions, voice help, quizzes, and progress in English, Hindi, and Bengali.',
    who: 'Who is Farmer Acharya?',
    about: 'Farmer Acharya is a practical guide for farmers and field workers. Ask about soil, seed, water, pest, disease, harvest, market, or farm profit, and the app gives short field-ready guidance with safety warnings when needed.',
    path: 'Starter Learning Path',
    modulesTitle: '25 Farming Modules',
    modulesSub: 'Built for practical decisions in the field.',
    module: 'Module',
    how: 'How to Use',
    habits: 'Four Core Habits',
    ready: 'Ready to Start?',
    choose: 'Choose Your Language',
    privacy: 'Your questions and answers may be stored for review and improvement. Do not enter sensitive personal information.',
    footer: 'Farmer Acharya · 25 modules · trilingual · mobile first',
    footer2: 'Learn better farming, ask better questions, keep better records.',
    tabs: [
      ['Learn', 'Read one short module before doing the field task.'],
      ['Ask', 'Ask crop questions by text, voice, or photo when available.'],
      ['Quiz', 'Check whether the idea is clear before applying it.'],
      ['Progress', 'Track completed modules, quiz attempts, and field work.'],
    ],
    modules: ['Know your farm', 'Soil health', 'Seeds and nursery', 'Irrigation', 'Nutrients', 'Pest and disease scouting', 'Harvest and market', 'Records and profit'],
  },
  hi: {
    home: 'होम',
    appName: 'फार्मर आचार्य',
    tagline: 'व्यावहारिक खेती मार्गदर्शक',
    hero: 'फसल सीखना, खेत के सवाल, आवाज सहायता, क्विज और प्रगति हिंदी, बंगाली और अंग्रेजी में।',
    who: 'फार्मर आचार्य क्या है?',
    about: 'फार्मर आचार्य किसानों और फील्ड वर्करों के लिए व्यावहारिक मार्गदर्शक है। मिट्टी, बीज, पानी, कीट, रोग, कटाई, बाजार और लाभ पर छोटे, खेत में काम आने वाले उत्तर मिलते हैं।',
    path: 'शुरुआती सीखने का रास्ता',
    modulesTitle: '25 खेती मॉड्यूल',
    modulesSub: 'खेत में सही फैसले लेने के लिए बनाया गया।',
    module: 'मॉड्यूल',
    how: 'कैसे इस्तेमाल करें',
    habits: 'चार मुख्य आदतें',
    ready: 'शुरू करने के लिए तैयार?',
    choose: 'अपनी भाषा चुनें',
    privacy: 'आपके सवाल और जवाब सुधार के लिए रखे जा सकते हैं। संवेदनशील निजी जानकारी न लिखें।',
    footer: 'फार्मर आचार्य · 25 मॉड्यूल · तीन भाषाएं · मोबाइल पहले',
    footer2: 'बेहतर खेती सीखें, बेहतर सवाल पूछें, बेहतर रिकॉर्ड रखें।',
    tabs: [
      ['सीखें', 'खेत के काम से पहले छोटा मॉड्यूल पढ़ें।'],
      ['पूछें', 'फसल के सवाल टेक्स्ट, आवाज या फोटो से पूछें।'],
      ['क्विज', 'समझ साफ है या नहीं, जल्दी जांचें।'],
      ['प्रगति', 'मॉड्यूल, क्विज और खेत के काम को ट्रैक करें।'],
    ],
    modules: ['अपना खेत जानें', 'मिट्टी स्वास्थ्य', 'बीज और नर्सरी', 'सिंचाई', 'पोषक तत्व', 'कीट और रोग जांच', 'कटाई और बाजार', 'रिकॉर्ड और लाभ'],
  },
  bn: {
    home: 'হোম',
    appName: 'ফার্মার আচার্য',
    tagline: 'ব্যবহারিক চাষের পথপ্রদর্শক',
    hero: 'ফসল শেখা, মাঠের প্রশ্ন, ভয়েস সাহায্য, কুইজ এবং অগ্রগতি বাংলা, হিন্দি ও ইংরেজিতে।',
    who: 'ফার্মার আচার্য কী?',
    about: 'ফার্মার আচার্য কৃষক ও মাঠকর্মীদের জন্য ব্যবহারিক গাইড। মাটি, বীজ, জল, পোকা, রোগ, কাটাই, বাজার ও লাভ নিয়ে ছোট, মাঠে কাজে লাগে এমন উত্তর দেয়।',
    path: 'শুরুর শেখার পথ',
    modulesTitle: '২৫টি চাষের মডিউল',
    modulesSub: 'মাঠে ব্যবহারিক সিদ্ধান্ত নেওয়ার জন্য তৈরি।',
    module: 'মডিউল',
    how: 'কীভাবে ব্যবহার করবেন',
    habits: 'চারটি মূল অভ্যাস',
    ready: 'শুরু করতে প্রস্তুত?',
    choose: 'আপনার ভাষা বাছুন',
    privacy: 'আপনার প্রশ্ন ও উত্তর উন্নতির জন্য সংরক্ষণ করা হতে পারে। সংবেদনশীল ব্যক্তিগত তথ্য লিখবেন না।',
    footer: 'ফার্মার আচার্য · ২৫ মডিউল · তিন ভাষা · মোবাইল প্রথম',
    footer2: 'ভাল চাষ শিখুন, ভাল প্রশ্ন করুন, ভাল রেকর্ড রাখুন।',
    tabs: [
      ['শিখুন', 'মাঠের কাজের আগে একটি ছোট মডিউল পড়ুন।'],
      ['জিজ্ঞাসা', 'ফসলের প্রশ্ন টেক্সট, ভয়েস বা ছবি দিয়ে করুন।'],
      ['কুইজ', 'বিষয়টি পরিষ্কার হয়েছে কি না দ্রুত যাচাই করুন।'],
      ['অগ্রগতি', 'মডিউল, কুইজ এবং মাঠের কাজ ট্র্যাক করুন।'],
    ],
    modules: ['নিজের খামার জানুন', 'মাটির স্বাস্থ্য', 'বীজ ও নার্সারি', 'সেচ', 'পুষ্টি', 'পোকা ও রোগ দেখা', 'কাটাই ও বাজার', 'রেকর্ড ও লাভ'],
  },
} as const;

export default function WelcomePage() {
  const router = useRouter();
  const { lang, setLang } = useStore();
  const c = copy[lang];

  function enter(selectedLang: Lang) {
    setLang(selectedLang);
    router.push('/learn');
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="absolute top-4 left-4 z-20">
        <Link href="/" className="inline-flex items-center gap-1.5 bg-cream/10 hover:bg-cream/20 text-cream border border-cream/30 backdrop-blur rounded-full px-3 py-1.5 text-[11px] font-mono tracking-[0.18em] uppercase transition-colors">
          <Icon name="arrowL" size={12} />
          {c.home}
        </Link>
      </div>

      <div className="bg-forest-deep text-cream px-6 pt-12 pb-14 text-center relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center">
          <Avatar size={92} useImage />
          <h1 className="font-serif italic text-4xl lg:text-5xl mt-5 leading-tight">{c.appName}</h1>
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-gold mt-3">{c.tagline}</p>
          <p className="text-cream/75 text-sm mt-3 max-w-md">{c.hero}</p>
        </div>
      </div>

      <div className="px-4 lg:px-6 -mt-8 relative z-10 mx-auto w-full max-w-md lg:max-w-5xl">
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
          <Card tone="cream" padding="lg" className="shadow-sm lg:col-span-2">
            <Tag tone="forest" filled className="mb-3">{c.who}</Tag>
            <p className="font-serif text-[15px] lg:text-[17px] leading-[1.65] text-ink">{c.about}</p>
          </Card>

          <Card tone="paper" padding="lg" className="shadow-sm">
            <div className="text-center mb-4">
              <Tag tone="gold" filled>{c.path}</Tag>
              <h2 className="font-serif italic text-2xl lg:text-3xl text-forest mt-3">{c.modulesTitle}</h2>
              <p className="text-[11px] text-muted mt-1">{c.modulesSub}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {c.modules.map((item) => (
                <div key={item} className="bg-cream rounded-xl p-3 border border-line">
                  <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-gold">{c.module}</div>
                  <div className="text-sm font-semibold text-forest mt-1 leading-tight">{item}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card tone="paper" padding="lg" className="shadow-sm">
            <div className="text-center mb-4">
              <Tag tone="forest" filled>{c.how}</Tag>
              <h2 className="font-serif italic text-2xl text-forest mt-3">{c.habits}</h2>
            </div>
            <div className="space-y-2">
              <TabExplain icon="book" name={c.tabs[0][0]} desc={c.tabs[0][1]} />
              <TabExplain icon="chat" name={c.tabs[1][0]} desc={c.tabs[1][1]} />
              <TabExplain icon="quiz" name={c.tabs[2][0]} desc={c.tabs[2][1]} />
              <TabExplain icon="chart" name={c.tabs[3][0]} desc={c.tabs[3][1]} />
            </div>
          </Card>

          <Card tone="forest" padding="lg" className="shadow-md lg:col-span-2">
            <div className="text-center mb-4">
              <Tag tone="cream" className="text-gold-soft">{c.ready}</Tag>
              <h2 className="font-serif italic text-3xl mt-3">{c.choose}</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto">
              <LangButton label="English" sub="Default" onClick={() => enter('en')} active />
              <LangButton label="हिन्दी" sub="Hindi" onClick={() => enter('hi')} />
              <LangButton label="বাংলা" sub="Bangla" onClick={() => enter('bn')} />
            </div>
            <div className="mt-5 max-w-2xl mx-auto flex items-start gap-2 text-cream/80 text-[11.5px] leading-snug">
              <Icon name="bell" size={14} className="mt-0.5 shrink-0 text-gold" />
              <p>{c.privacy}</p>
            </div>
          </Card>
        </div>

        <div className="my-8 text-center">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted">{c.footer}</p>
          <p className="font-serif italic text-sm text-forest mt-2">{c.footer2}</p>
        </div>
      </div>
    </div>
  );
}

function LangButton({ label, sub, onClick, active = false }: { label: string; sub: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`${active ? 'bg-cream text-forest hover:bg-sage' : 'bg-cream/0 text-cream border border-cream/40 hover:bg-cream/10'} rounded-xl py-4 px-3 font-semibold transition-colors active:scale-[0.98]`}>
      <span className="block text-lg">{label}</span>
      <span className={`${active ? 'text-muted' : 'text-cream/60'} text-[10px] tracking-[0.18em] uppercase block mt-0.5`}>{sub}</span>
    </button>
  );
}

function TabExplain({ icon, name, desc }: { icon: IconName; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-cream transition-colors">
      <div className="w-9 h-9 rounded-full bg-sage flex items-center justify-center text-forest shrink-0">
        <Icon name={icon} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-forest">{name}</div>
        <div className="text-[11px] text-muted leading-snug mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
