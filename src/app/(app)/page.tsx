'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { t } from '@/lib/i18n/labels';
import { getTitle } from '@/lib/types';
import type { Video } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Icon, type IconName } from '@/components/ui/Icon';

export default function HomeDashboard() {
  const { lang, modules, selectedModuleId, progress, quizAttempts } = useStore();
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.content.videos(undefined, 20)
      .then((vids) => { if (!cancelled) setVideos(vids); })
      .catch(() => { if (!cancelled) setVideos([]); });
    return () => { cancelled = true; };
  }, []);

  const currentModule = modules.find((m) => m.id === selectedModuleId);
  const currentProgress = progress[selectedModuleId];
  const sectionsDone = currentProgress?.sections_completed?.length || 0;
  const completedModules = Object.values(progress).filter((p) => p.completed).length;
  const totalModules = modules.length;
  const totalQuizzes = quizAttempts.length;
  const videoCount = videos.length;
  const avgScore = totalQuizzes > 0
    ? Math.round(quizAttempts.reduce((sum, q) => sum + (q.score / q.total) * 100, 0) / totalQuizzes)
    : 0;
  const moduleWord = totalModules === 1 ? 'module' : 'modules';
  const quizWord = totalQuizzes === 1 ? 'quiz' : 'quizzes';
  const videoWord = videoCount === 1 ? 'video' : 'videos';
  const learnDesc = totalModules > 0
    ? `${totalModules} ${moduleWord} loaded from Supabase · read and track progress`
    : 'Loading modules from Supabase';
  const quizDesc = totalQuizzes > 0
    ? `${totalQuizzes} ${quizWord} taken · ${avgScore}% average score`
    : `${totalModules || 'Your'} ${moduleWord} can generate 5-question quizzes`;
  const videoDesc = videoCount > 0
    ? `${videoCount} ${videoWord} available from Supabase`
    : 'No videos added yet · add links in Supabase';

  const greeting = lang === 'bn' ? 'নমস্কার' : lang === 'hi' ? 'नमस्कार' : 'Welcome back';
  const today = new Date().toLocaleDateString(lang === 'bn' ? 'bn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long', day: 'numeric', month: 'short',
  });

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-5 space-y-5">
      {/* Greeting hero */}
      <Card tone="forest" padding="lg" className="relative overflow-hidden">
        <div className="absolute -right-6 -top-6 opacity-10 pointer-events-none">
          <Avatar size={140} useImage />
        </div>
        <div className="relative">
          <Tag tone="cream" className="text-gold-soft">{today}</Tag>
          <h1 className="font-serif italic text-3xl lg:text-4xl mt-2 text-cream">
            {greeting}
          </h1>
          <p className="text-cream/80 text-sm mt-2 max-w-md">
            {lang === 'bn'
              ? 'আজ Vajra Acharya সাথে কী শিখবে?'
              : lang === 'hi'
              ? 'आज Vajra Acharya के साथ क्या सीखोगे?'
              : 'What will you learn with Vajra Acharya today?'}
          </p>
        </div>
      </Card>

      {/* Continue learning */}
      {currentModule && (
        <Link href="/learn" className="block">
          <Card tone="cream" padding="lg" className="hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-sage flex items-center justify-center text-forest shrink-0">
                <Icon name="book" size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <Tag tone="muted">
                  {lang === 'bn' ? 'চালিয়ে যাও' : lang === 'hi' ? 'जारी रखो' : 'Continue learning'}
                </Tag>
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
              <Icon
                name="arrowR"
                size={20}
                className="text-forest shrink-0 group-hover:translate-x-1 transition-transform"
              />
            </div>
          </Card>
        </Link>
      )}

      {/* North Star quick stats */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <Tag tone="muted">
            {lang === 'bn' ? '৩ মাসের লক্ষ্য' : lang === 'hi' ? '३ महीने का लक्ष्य' : '3-month North Star'}
          </Tag>
          <Link
            href="/start"
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-forest hover:underline inline-flex items-center gap-1"
          >
            {lang === 'bn' ? 'বিস্তারিত' : lang === 'hi' ? 'विस्तार' : 'Read more'}
            <Icon name="arrowR" size={11} />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <NorthStarCard num="100" label="TMIL" />
          <NorthStarCard num="100" label="Balconies" />
          <NorthStarCard num="10" label="Projects" />
          <NorthStarCard num="₹25K" label={lang === 'bn' ? 'প্রতিদিন' : lang === 'hi' ? 'रोज़' : '/day'} />
        </div>
      </section>

      {/* Tab briefs + Featured videos in a 2-col layout on desktop */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Tab briefs */}
        <section className="lg:col-span-2 space-y-2.5">
          <Tag tone="muted" className="block">
            {lang === 'bn' ? 'কী করতে চাও?' : lang === 'hi' ? 'क्या करना चाहते हो?' : 'What do you want to do?'}
          </Tag>
          <BriefLink
            href="/learn"
            icon="book"
            title={t('learn', lang)}
            desc={learnDesc}
          />
          <BriefLink
            href="/quiz"
            icon="quiz"
            title={t('quiz', lang)}
            desc={quizDesc}
          />
          <BriefLink
            href="/ask"
            icon="chat"
            title={t('ask', lang)}
            desc={lang === 'bn'
              ? 'Vajra Acharya সাথে চ্যাট · কথা বা লিখে প্রশ্ন'
              : lang === 'hi'
              ? 'Vajra Acharya चैट · बोलकर या लिखकर सवाल'
              : 'Chat with Vajra Acharya · voice or text'}
          />
          <BriefLink
            href="/apply"
            icon="hand"
            title={t('apply', lang)}
            desc={lang === 'bn'
              ? 'মাঠের প্রয়োগ · ভিজিটের পরে রিপোর্ট করো'
              : lang === 'hi'
              ? 'मैदान अभ्यास · विज़िट के बाद रिपोर्ट'
              : 'Field debrief · report after each visit'}
          />
          <BriefLink
            href="/video"
            icon="play"
            title={t('video', lang)}
            desc={videoDesc}
          />
          <BriefLink
            href="/progress"
            icon="chart"
            title={t('me', lang)}
            desc={`${completedModules}/${totalModules || 0} ${moduleWord} completed · ${totalQuizzes} ${quizWord} · ${avgScore || 0}% avg`}
          />
        </section>

        {/* Featured videos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <Tag tone="muted">
              {lang === 'bn' ? 'অরিয়েন্টেশন ভিডিও' : lang === 'hi' ? 'ओरिएंटेशन वीडियो' : 'Orientation videos'}
            </Tag>
            <Link
              href="/video"
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-forest hover:underline inline-flex items-center gap-1"
            >
              {lang === 'bn' ? 'সব দেখো' : lang === 'hi' ? 'सब देखो' : 'See all'}
              <Icon name="arrowR" size={11} />
            </Link>
          </div>
          {videos.length === 0 ? (
            <Card tone="surface" padding="md">
              <p className="text-xs text-muted italic">
                {lang === 'bn' ? 'লোড হচ্ছে...' : lang === 'hi' ? 'लोड हो रहा है...' : 'Loading...'}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {videos.slice(0, 3).map((video) => (
                <Link
                  key={video.id}
                  href="/video"
                  className="block"
                >
                  <Card tone="surface" padding="none" className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 p-2">
                      <div className="relative w-20 aspect-video rounded-md overflow-hidden bg-line shrink-0">
                        <img
                          src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                          alt={getTitle(video, lang)}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-ink/30">
                          <Icon name="play" size={16} color="var(--color-cream)" strokeWidth={2.5} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-[13.5px] text-ink leading-tight line-clamp-2">
                          {getTitle(video, lang)}
                        </p>
                        {video.duration && (
                          <Tag tone="muted" className="mt-1">{video.duration}</Tag>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Onboarding link */}
      <Card tone="paper" padding="lg" className="border-dashed">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-gold-soft flex items-center justify-center text-forest shrink-0">
            <Icon name="sparkle" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-serif italic text-lg text-ink leading-tight">
              {lang === 'bn'
                ? 'প্রথমবার এখানে?'
                : lang === 'hi'
                ? 'पहली बार यहाँ?'
                : 'First time here?'}
            </h4>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {lang === 'bn'
                ? '৭ দিনের যাত্রা · ৩ মাসের লক্ষ্য · ৪টি ট্যাব — পুরো অরিয়েন্টেশন পড়ো।'
                : lang === 'hi'
                ? '7 दिन की यात्रा · 3 महीने का लक्ष्य · 4 टैब — पूरा ओरिएंटेशन पढ़ो।'
                : "7-day journey · 3-month North Star · 4 tabs — read the full orientation."}
            </p>
          </div>
          <Link
            href="/start"
            className="inline-flex items-center gap-2 bg-forest text-cream hover:bg-forest-deep transition-colors rounded-full px-4 py-2 text-xs font-semibold shrink-0"
          >
            {lang === 'bn' ? 'খুলো' : lang === 'hi' ? 'खोलो' : 'Open'}
            <Icon name="arrowR" size={14} />
          </Link>
        </div>
      </Card>
    </div>
  );
}

function NorthStarCard({ num, label }: { num: string; label: string }) {
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
          <Icon
            name="arrowR"
            size={16}
            className="text-muted shrink-0 group-hover:text-forest group-hover:translate-x-1 transition-all"
          />
        </div>
      </Card>
    </Link>
  );
}





