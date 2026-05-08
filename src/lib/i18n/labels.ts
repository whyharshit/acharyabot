import type { Lang } from "../types";

const labels = {
  appName: { bn: "বজ্র আচার্য", hi: "वज्र आचार्य", en: "Vajra Acharya" },
  appTraining: { bn: "ইলেকট্রিশিয়ান ট্রেনিং", hi: "इलेक्ट्रीशियन ट्रेनिंग", en: "Electrician Training" },

  learn: { bn: "শিখুন", hi: "सीखें", en: "Learn" },
  ask: { bn: "জিজ্ঞাসা", hi: "पूछें", en: "Ask" },
  quiz: { bn: "কুইজ", hi: "क्विज़", en: "Quiz" },
  video: { bn: "ভিডিও", hi: "वीडियो", en: "Video" },
  apply: { bn: "প্রয়োগ", hi: "अभ्यास", en: "Apply" },
  progress: { bn: "অগ্রগতি", hi: "प्रगति", en: "Progress" },

  home: { bn: "হোম", hi: "होम", en: "Home" },
  coach: { bn: "কোচ", hi: "कोच", en: "Coach" },
  me: { bn: "আমি", hi: "मैं", en: "Me" },
  report: { bn: "রিপোর্ট", hi: "रिपोर्ट", en: "Report" },

  privacyNotice: {
    bn: "আপনার প্রশ্ন ও উত্তর Vajra Acharya পর্যালোচনার জন্য সংরক্ষণ করা হয়। ব্যক্তিগত তথ্য লিখবেন না।",
    hi: "आपके सवाल और जवाब Vajra Acharya समीक्षा के लिए सुरक्षित रखे जाते हैं। निजी जानकारी न लिखें।",
    en: "Your questions and answers are stored for Vajra Acharya review. Do not enter private information.",
  },
  menu: { bn: "মেনু", hi: "मेनू", en: "Menu" },
  tapForMenu: {
    bn: "ভাষা, মডিউল ও অপশন দেখতে এখানে চাপুন",
    hi: "भाषा, मॉड्यूल और विकल्पों के लिए यहाँ दबाएँ",
    en: "Tap here for language, modules and options",
  },
  gotIt: { bn: "বুঝেছি", hi: "समझ गया", en: "Got it" },
  logout: { bn: "লগআউট", hi: "लॉगआउट", en: "Logout" },

  learnIcon: { bn: "book", hi: "book", en: "book" },
  askIcon: { bn: "chat", hi: "chat", en: "chat" },
  quizIcon: { bn: "quiz", hi: "quiz", en: "quiz" },
  videoIcon: { bn: "play", hi: "play", en: "play" },
  applyIcon: { bn: "hand", hi: "hand", en: "hand" },
  progressIcon: { bn: "chart", hi: "chart", en: "chart" },

  selectModule: { bn: "মডিউল বাছুন", hi: "मॉड्यूल चुनें", en: "Select Module" },
  language: { bn: "ভাষা", hi: "भाषा", en: "Language" },

  sections: { bn: "সেকশন", hi: "सेक्शन", en: "Sections" },
  theoryHours: { bn: "থিওরি", hi: "थ्योरी", en: "Theory" },
  practicalHours: { bn: "প্র্যাকটিক্যাল", hi: "प्रैक्टिकल", en: "Practical" },
  hours: { bn: "ঘণ্টা", hi: "घंटे", en: "hours" },
  markComplete: { bn: "সম্পন্ন চিহ্নিত করুন", hi: "पूरा चिह्नित करें", en: "Mark Complete" },
  completed: { bn: "সম্পন্ন", hi: "पूरा", en: "Completed" },
  outcomes: { bn: "শেখার ফলাফল", hi: "सीखने के परिणाम", en: "Learning Outcomes" },

  typeMessage: { bn: "আপনার ইলেকট্রিক্যাল প্রশ্ন লিখুন...", hi: "अपना इलेक्ट्रिकल सवाल लिखें...", en: "Type your electrical question..." },
  send: { bn: "পাঠান", hi: "भेजें", en: "Send" },
  listening: { bn: "শুনছি...", hi: "सुन रहा हूँ...", en: "Listening..." },
  thinking: { bn: "ভাবছে...", hi: "सोच रहा है...", en: "Thinking..." },
  speaking: { bn: "বলছে...", hi: "बोल रहा है...", en: "Speaking..." },
  voiceOn: { bn: "ভয়েস উত্তর", hi: "वॉइस जवाब", en: "Voice reply" },

  startQuiz: { bn: "কুইজ শুরু করুন", hi: "क्विज़ शुरू करें", en: "Start Quiz" },
  question: { bn: "প্রশ্ন", hi: "प्रश्न", en: "Question" },
  of: { bn: "এর মধ্যে", hi: "में से", en: "of" },
  score: { bn: "স্কোর", hi: "स्कोर", en: "Score" },
  correct: { bn: "সঠিক!", hi: "सही!", en: "Correct!" },
  incorrect: { bn: "ভুল", hi: "गलत", en: "Incorrect" },
  next: { bn: "পরবর্তী", hi: "अगला", en: "Next" },
  retake: { bn: "আবার দিন", hi: "फिर से दें", en: "Retake" },
  quizResult: { bn: "ফলাফল", hi: "परिणाम", en: "Result" },

  noVideos: { bn: "এই মডিউলে কোনো ভিডিও নেই", hi: "इस मॉड्यूल में कोई वीडियो नहीं है", en: "No videos for this module" },
  watchVideo: { bn: "দেখুন", hi: "देखें", en: "Watch" },

  overall: { bn: "সব মিলিয়ে", hi: "कुल मिलाकर", en: "Overall" },
  modulesCompleted: { bn: "সম্পন্ন মডিউল", hi: "पूरे मॉड्यूल", en: "Modules Completed" },
  quizzesTaken: { bn: "দেওয়া কুইজ", hi: "दिए गए क्विज़", en: "Quizzes Taken" },
  badgesEarned: { bn: "অর্জিত ব্যাজ", hi: "मिले बैज", en: "Badges Earned" },
  avgScore: { bn: "গড় স্কোর", hi: "औसत स्कोर", en: "Avg Score" },

  comingSoon: { bn: "শীঘ্রই আসছে", hi: "जल्द आ रहा है", en: "Coming Soon" },
  applyDesc: {
    bn: "মাঠের কাজে কীভাবে ইলেকট্রিক্যাল দক্ষতা প্রয়োগ করলেন তা লিখুন।",
    hi: "मैदान के काम में आपने इलेक्ट्रिकल कौशल कैसे लागू किया, यह दर्ज करें।",
    en: "Record how you applied electrical skills during field work.",
  },

  quickActions: {
    bn: [
      { label: "MCB ট্রিপ করছে", message: "MCB কেন ট্রিপ করে এবং নিরাপদে কীভাবে পরীক্ষা করব?" },
      { label: "সকেট পুড়েছে", message: "সকেটে পোড়ার দাগ আছে। প্রথমে কী পরীক্ষা করব?" },
      { label: "RCCB বনাম MCB", message: "MCB আর RCCB-এর পার্থক্য সহজ ভাষায় বোঝাও।" },
      { label: "তারের সাইজ", message: "ঘরের সার্কিটের জন্য তারের সাইজ কীভাবে বাছব?" },
      { label: "আর্থিং", message: "আর্থিং কেন জরুরি এবং নিরাপদে কীভাবে টেস্ট করব?" },
    ],
    hi: [
      { label: "MCB ट्रिप", message: "MCB क्यों ट्रिप करता है और सुरक्षित तरीके से कैसे जांचूँ?" },
      { label: "सॉकेट जला", message: "सॉकेट पर जलने के निशान हैं। पहले क्या जांचना चाहिए?" },
      { label: "RCCB बनाम MCB", message: "MCB और RCCB का फर्क आसान शब्दों में समझाओ।" },
      { label: "वायर साइज", message: "घर के सर्किट के लिए वायर साइज कैसे चुनूँ?" },
      { label: "अर्थिंग", message: "अर्थिंग क्यों जरूरी है और सुरक्षित तरीके से कैसे टेस्ट करूँ?" },
    ],
    en: [
      { label: "MCB tripping", message: "Why does an MCB trip and how should I diagnose it safely?" },
      { label: "Socket burned", message: "A socket has burn marks. What should I check first?" },
      { label: "RCCB vs MCB", message: "Explain the difference between MCB and RCCB in simple words." },
      { label: "Wire size", message: "How do I choose wire size for a home circuit?" },
      { label: "Earthing", message: "Why is earthing important and how do I test it safely?" },
    ],
  },

  langNames: { bn: "বাংলা", hi: "हिन्दी", en: "English" },
  compulsory: { bn: "ভিত্তি", hi: "बुनियाद", en: "Foundation" },
  elective: { bn: "উন্নত", hi: "उन्नत", en: "Advanced" },
} as const;

export function t(key: keyof typeof labels, lang: Lang): string {
  const val = labels[key];
  if (typeof val === "object" && lang in val) {
    return (val as Record<Lang, string>)[lang];
  }
  return String(val);
}

export function getQuickActions(lang: Lang) {
  return labels.quickActions[lang];
}

export default labels;


