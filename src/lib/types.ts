export type Lang = 'bn' | 'hi' | 'en';

export interface Module {
  id: string;
  title_bn: string;
  title_hi: string;
  title_en: string;
  icon: string;
  theory_hours: number;
  practical_hours: number;
  sort_order: number;
  group_key: string;
  group_label_bn: string | null;
  group_label_hi: string | null;
  group_label_en: string | null;
}

export interface Section {
  id: string;
  module_id: string;
  title_bn: string;
  title_hi: string;
  title_en: string;
  sort_order: number;
  estimated_hours: number;
}

export interface Content {
  id: string;
  section_id: string;
  lang: Lang;
  body: string;
  status: 'draft' | 'review' | 'published';
}

export interface Video {
  id: string;
  youtube_id: string;
  module_id: string;
  title_bn: string;
  title_hi: string;
  title_en: string;
  duration: string | null;
  start_seconds?: number | null;
}

export interface Badge {
  id: string;
  icon: string;
  title_bn: string;
  title_hi: string;
  title_en: string;
  condition_desc: string;
}

export interface Learner {
  id: string;
  device_id: string;
  name: string | null;
  phone: string | null;
  preferred_lang: Lang;
}

export interface Progress {
  id: string;
  learner_id: string;
  module_id: string;
  sections_completed: string[];
  time_spent_minutes: number;
  completed: boolean;
  completed_at: string | null;
}

export interface QuizAttempt {
  id: string;
  learner_id: string;
  module_id: string;
  score: number;
  total: number;
  questions: QuizQuestion[];
  created_at: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface EarnedBadge {
  id: string;
  learner_id: string;
  badge_id: string;
  earned_at: string;
}

const titleFallbacks: Record<string, Partial<Record<Lang, string>>> = {
  "M01-safety": { bn: "ইলেকট্রিক্যাল সেফটির বেসিক", hi: "इलेक्ट्रिकल सुरक्षा की बुनियाद" },
  "M02-tools": { bn: "টুলস ও টেস্টার", hi: "टूल्स और टेस्टर" },
  "M03-wires": { bn: "তার ও কেবল সাইজ", hi: "वायर और केबल साइज" },
  "M04-switchboards": { bn: "সুইচ, সকেট ও বোর্ড", hi: "स्विच, सॉकेट और बोर्ड" },
  "M05-protection": { bn: "MCB, RCCB ও DB বেসিক", hi: "MCB, RCCB और DB की बुनियाद" },
  "M06-fault-finding": { bn: "ফল্ট খোঁজা", hi: "फॉल्ट फाइंडिंग" },
  "M07-earthing": { bn: "আর্থিং ও টেস্টিং", hi: "अर्थिंग और टेस्टिंग" },
  "M08-load": { bn: "লোড ক্যালকুলেশন", hi: "लोड कैलकुलेशन" },
  "M15-video-library": { bn: "ভিডিও লাইব্রেরি", hi: "वीडियो लाइब्रेरी" },

  "S01-01": { bn: "প্রথমে মেইন সাপ্লাই বন্ধ", hi: "पहले मेन सप्लाई बंद" },
  "S01-02": { bn: "PPE ও বিপদের চিহ্ন", hi: "PPE और खतरे के संकेत" },
  "S02-01": { bn: "বেসিক ইলেকট্রিশিয়ান টুলস", hi: "बेसिक इलेक्ट्रीशियन टूल्स" },
  "S03-01": { bn: "তারের সাইজের বেসিক", hi: "वायर साइज की बुनियाद" },
  "S04-01": { bn: "সুইচবোর্ড পরীক্ষা", hi: "स्विचबोर्ड जांच" },
  "S05-01": { bn: "MCB ও RCCB-এর পার্থক্য", hi: "MCB और RCCB का फर्क" },
  "S06-01": { bn: "বিদ্যুৎ না থাকার অভিযোগ", hi: "बिजली न आने की शिकायत" },
  "S07-01": { bn: "আর্থিং কেন জরুরি", hi: "अर्थिंग क्यों जरूरी है" },
  "S08-01": { bn: "ওভারলোড এড়ানো", hi: "ओवरलोड से बचें" },
};

const groupFallbacks: Record<string, Partial<Record<Lang, string>>> = {
  foundation: { bn: "ভিত্তি", hi: "बुनियाद" },
  wiring: { bn: "ওয়্যারিং", hi: "वायरिंग" },
  protection: { bn: "সুরক্ষা", hi: "सुरक्षा" },
  service: { bn: "সার্ভিস", hi: "सर्विस" },
  resources: { bn: "রিসোর্স", hi: "संसाधन" },
};

export function getTitle(item: { title_bn: string; title_hi: string; title_en: string }, lang: Lang): string {
  const localized = item[`title_${lang}`]?.trim();
  const english = item.title_en?.trim();
  const id = "id" in item && typeof item.id === "string" ? item.id : "";
  const fallback = id ? titleFallbacks[id]?.[lang] : undefined;

  if (lang !== "en" && fallback && (!localized || localized === english)) {
    return fallback;
  }

  return localized || english || fallback || "";
}

export function getGroupLabel(mod: Module, lang: Lang): string {
  const localized = mod[`group_label_${lang}`]?.trim();
  const english = mod.group_label_en?.trim();
  const fallback = groupFallbacks[mod.group_key]?.[lang];

  if (lang !== "en" && fallback && (!localized || localized === english)) {
    return fallback;
  }

  return localized || english || fallback || mod.group_key;
}


