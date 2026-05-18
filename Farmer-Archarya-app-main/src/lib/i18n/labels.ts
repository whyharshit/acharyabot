import type { Lang } from '../types';

const labels = {
  appName: { bn: 'ফার্মার আচার্য', hi: 'फार्मर आचार्य', en: 'Farmer Acharya' },

  learn: { bn: 'শিখুন', hi: 'सीखें', en: 'Learn' },
  ask: { bn: 'জিজ্ঞাসা', hi: 'पूछें', en: 'Ask' },
  quiz: { bn: 'কুইজ', hi: 'क्विज', en: 'Quiz' },
  video: { bn: 'ভিডিও', hi: 'वीडियो', en: 'Video' },
  apply: { bn: 'প্রয়োগ', hi: 'अभ्यास', en: 'Apply' },
  tools: { bn: 'সরঞ্জাম', hi: 'औजार', en: 'Tools' },
  progress: { bn: 'অগ্রগতি', hi: 'प्रगति', en: 'Progress' },

  home: { bn: 'হোম', hi: 'होम', en: 'Home' },
  coach: { bn: 'কোচ', hi: 'कोच', en: 'Coach' },
  me: { bn: 'আমার', hi: 'मेरा', en: 'Me' },
  report: { bn: 'রিপোর্ট', hi: 'रिपोर्ट', en: 'Report' },

  privacyNotice: {
    bn: 'আপনার প্রশ্ন ও উত্তর ফার্মার আচার্য দল মান উন্নয়নের জন্য সংরক্ষণ করতে পারে। সংবেদনশীল ব্যক্তিগত তথ্য লিখবেন না।',
    hi: 'आपके सवाल और जवाब फार्मर आचार्य टीम सुधार के लिए रख सकती है। संवेदनशील निजी जानकारी न लिखें।',
    en: 'Your questions and answers are stored for Farmer Acharya review and improvement. Please do not enter sensitive personal information.',
  },
  menu: { bn: 'মেনু', hi: 'मेनू', en: 'Menu' },
  tapForMenu: {
    bn: 'এখানে চাপুন - ভাষা, পাঠ এবং সব বিকল্প এখানে',
    hi: 'यहां दबाएं - भाषा, पाठ और सभी विकल्प यहां हैं',
    en: 'Tap here - language, modules, all options',
  },
  gotIt: { bn: 'বুঝেছি', hi: 'समझ गया', en: 'Got it' },

  learnIcon: { bn: 'book', hi: 'book', en: 'book' },
  askIcon: { bn: 'chat', hi: 'chat', en: 'chat' },
  quizIcon: { bn: 'quiz', hi: 'quiz', en: 'quiz' },
  videoIcon: { bn: 'video', hi: 'video', en: 'video' },
  applyIcon: { bn: 'crop', hi: 'crop', en: 'crop' },
  progressIcon: { bn: 'chart', hi: 'chart', en: 'chart' },

  selectModule: { bn: 'মডিউল নির্বাচন', hi: 'मॉड्यूल चुनें', en: 'Select Module' },
  language: { bn: 'ভাষা', hi: 'भाषा', en: 'Language' },

  sections: { bn: 'বিষয়সমূহ', hi: 'विषय', en: 'Sections' },
  theoryHours: { bn: 'তত্ত্ব', hi: 'सिद्धांत', en: 'Theory' },
  practicalHours: { bn: 'ব্যবহারিক', hi: 'व्यावहारिक', en: 'Practical' },
  hours: { bn: 'ঘণ্টা', hi: 'घंटे', en: 'hours' },
  markComplete: { bn: 'সম্পূর্ণ করুন', hi: 'पूरा करें', en: 'Mark Complete' },
  completed: { bn: 'সম্পন্ন', hi: 'पूर्ण', en: 'Completed' },
  outcomes: { bn: 'শেখার ফলাফল', hi: 'सीखने के परिणाम', en: 'Learning Outcomes' },

  typeMessage: { bn: 'আপনার প্রশ্ন লিখুন...', hi: 'अपना सवाल लिखें...', en: 'Type your question...' },
  send: { bn: 'পাঠান', hi: 'भेजें', en: 'Send' },
  listening: { bn: 'শুনছি...', hi: 'सुन रहा हूं...', en: 'Listening...' },
  thinking: { bn: 'ভাবছি...', hi: 'सोच रहा हूं...', en: 'Thinking...' },
  speaking: { bn: 'বলছি...', hi: 'बोल रहा हूं...', en: 'Speaking...' },
  voiceOn: { bn: 'ভয়েস উত্তর', hi: 'आवाज में जवाब', en: 'Voice reply' },

  startQuiz: { bn: 'কুইজ শুরু করুন', hi: 'क्विज शुरू करें', en: 'Start Quiz' },
  question: { bn: 'প্রশ্ন', hi: 'प्रश्न', en: 'Question' },
  of: { bn: '/', hi: '/', en: 'of' },
  score: { bn: 'স্কোর', hi: 'स्कोर', en: 'Score' },
  correct: { bn: 'সঠিক!', hi: 'सही!', en: 'Correct!' },
  incorrect: { bn: 'ভুল', hi: 'गलत', en: 'Incorrect' },
  next: { bn: 'পরবর্তী', hi: 'अगला', en: 'Next' },
  retake: { bn: 'আবার দিন', hi: 'फिर से दें', en: 'Retake' },
  quizResult: { bn: 'ফলাফল', hi: 'परिणाम', en: 'Result' },

  noVideos: { bn: 'এই মডিউলে কোনও ভিডিও নেই', hi: 'इस मॉड्यूल में कोई वीडियो नहीं है', en: 'No videos for this module' },
  watchVideo: { bn: 'দেখুন', hi: 'देखें', en: 'Watch' },

  overall: { bn: 'সামগ্রিক', hi: 'समग्र', en: 'Overall' },
  modulesCompleted: { bn: 'মডিউল সম্পন্ন', hi: 'मॉड्यूल पूरे', en: 'Modules Completed' },
  quizzesTaken: { bn: 'কুইজ দেওয়া হয়েছে', hi: 'क्विज दिए गए', en: 'Quizzes Taken' },
  badgesEarned: { bn: 'ব্যাজ অর্জিত', hi: 'बैज अर्जित', en: 'Badges Earned' },
  avgScore: { bn: 'গড় স্কোর', hi: 'औसत स्कोर', en: 'Avg Score' },

  comingSoon: { bn: 'শীঘ্রই আসছে', hi: 'जल्द आ रहा है', en: 'Coming Soon' },
  applyDesc: {
    bn: 'আপনি মাঠে যা শিখেছেন তা কীভাবে কাজে লাগাচ্ছেন, তা রেকর্ড করুন',
    hi: 'खेत में सीखी हुई बातों को कैसे लागू कर रहे हैं, यह रिकॉर्ड करें',
    en: 'Record how you are applying what you learned in the field',
  },

  quickActions: {
    bn: [
      { label: 'মাটির স্বাস্থ্য', message: 'বপনের আগে মাটির স্বাস্থ্য কীভাবে উন্নত করব?' },
      { label: 'বীজ নির্বাচন', message: 'ভাল বীজ কীভাবে নির্বাচন করব?' },
      { label: 'সেচ দরকার?', message: 'ফসলে এখন সেচ দরকার কি না কীভাবে বুঝব?' },
      { label: 'পোকা পরীক্ষা', message: 'পোকা দেখলে স্প্রে করার আগে কী কী দেখব?' },
      { label: 'লাভ হিসাব', message: 'ফসলের লাভ সহজভাবে কীভাবে হিসাব করব?' },
    ],
    hi: [
      { label: 'मिट्टी स्वास्थ्य', message: 'बुवाई से पहले मिट्टी का स्वास्थ्य कैसे सुधारूं?' },
      { label: 'बीज चुनाव', message: 'अच्छा बीज कैसे चुनूं?' },
      { label: 'सिंचाई चाहिए?', message: 'फसल को अभी सिंचाई चाहिए या नहीं, कैसे पहचानूं?' },
      { label: 'कीट जांच', message: 'कीट दिखने पर स्प्रे से पहले क्या-क्या देखूं?' },
      { label: 'लाभ हिसाब', message: 'फसल का लाभ सरल तरीके से कैसे निकालूं?' },
    ],
    en: [
      { label: 'Soil health', message: 'How do I improve soil health before sowing?' },
      { label: 'Seed choice', message: 'How should I choose good seed for my crop?' },
      { label: 'Water stress', message: 'How can I tell if my crop needs irrigation?' },
      { label: 'Pest check', message: 'What should I observe before spraying for pests?' },
      { label: 'Profit records', message: 'How do I calculate crop profit in a simple way?' },
    ],
  },

  langNames: { bn: 'বাংলা', hi: 'हिन्दी', en: 'English' },

  compulsory: { bn: 'বাধ্যতামূলক', hi: 'अनिवार्य', en: 'Compulsory' },
  elective: { bn: 'ঐচ্ছিক', hi: 'वैकल्पिक', en: 'Elective' },
} as const;

export function t(key: keyof typeof labels, lang: Lang): string {
  const val = labels[key];
  if (typeof val === 'object' && lang in val) {
    return (val as Record<Lang, string>)[lang];
  }
  return String(val);
}

export function getQuickActions(lang: Lang) {
  return labels.quickActions[lang];
}

export default labels;
