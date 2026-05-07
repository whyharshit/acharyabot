import type { Lang } from "../types";

const labels = {
  appName: { bn: "Vajra Acharya", hi: "Vajra Acharya", en: "Vajra Acharya" },

  learn: { bn: "Learn", hi: "Learn", en: "Learn" },
  ask: { bn: "Ask", hi: "Ask", en: "Ask" },
  quiz: { bn: "Quiz", hi: "Quiz", en: "Quiz" },
  video: { bn: "Video", hi: "Video", en: "Video" },
  apply: { bn: "Apply", hi: "Apply", en: "Apply" },
  progress: { bn: "Progress", hi: "Progress", en: "Progress" },

  home: { bn: "Home", hi: "Home", en: "Home" },
  coach: { bn: "Coach", hi: "Coach", en: "Coach" },
  me: { bn: "Me", hi: "Me", en: "Me" },
  report: { bn: "Report", hi: "Report", en: "Report" },

  privacyNotice: {
    bn: "Your questions and answers are stored for Vajra Acharya review. Do not enter private information.",
    hi: "Your questions and answers are stored for Vajra Acharya review. Do not enter private information.",
    en: "Your questions and answers are stored for Vajra Acharya review. Do not enter private information.",
  },
  menu: { bn: "Menu", hi: "Menu", en: "Menu" },
  tapForMenu: {
    bn: "Tap here for language, modules and options",
    hi: "Tap here for language, modules and options",
    en: "Tap here for language, modules and options",
  },
  gotIt: { bn: "Got it", hi: "Got it", en: "Got it" },

  learnIcon: { bn: "book", hi: "book", en: "book" },
  askIcon: { bn: "chat", hi: "chat", en: "chat" },
  quizIcon: { bn: "quiz", hi: "quiz", en: "quiz" },
  videoIcon: { bn: "play", hi: "play", en: "play" },
  applyIcon: { bn: "hand", hi: "hand", en: "hand" },
  progressIcon: { bn: "chart", hi: "chart", en: "chart" },

  selectModule: { bn: "Select Module", hi: "Select Module", en: "Select Module" },
  language: { bn: "Language", hi: "Language", en: "Language" },

  sections: { bn: "Sections", hi: "Sections", en: "Sections" },
  theoryHours: { bn: "Theory", hi: "Theory", en: "Theory" },
  practicalHours: { bn: "Practical", hi: "Practical", en: "Practical" },
  hours: { bn: "hours", hi: "hours", en: "hours" },
  markComplete: { bn: "Mark Complete", hi: "Mark Complete", en: "Mark Complete" },
  completed: { bn: "Completed", hi: "Completed", en: "Completed" },
  outcomes: { bn: "Learning Outcomes", hi: "Learning Outcomes", en: "Learning Outcomes" },

  typeMessage: { bn: "Type your electrical question...", hi: "Type your electrical question...", en: "Type your electrical question..." },
  send: { bn: "Send", hi: "Send", en: "Send" },
  listening: { bn: "Listening...", hi: "Listening...", en: "Listening..." },
  thinking: { bn: "Thinking...", hi: "Thinking...", en: "Thinking..." },
  speaking: { bn: "Speaking...", hi: "Speaking...", en: "Speaking..." },
  voiceOn: { bn: "Voice reply", hi: "Voice reply", en: "Voice reply" },

  startQuiz: { bn: "Start Quiz", hi: "Start Quiz", en: "Start Quiz" },
  question: { bn: "Question", hi: "Question", en: "Question" },
  of: { bn: "of", hi: "of", en: "of" },
  score: { bn: "Score", hi: "Score", en: "Score" },
  correct: { bn: "Correct!", hi: "Correct!", en: "Correct!" },
  incorrect: { bn: "Incorrect", hi: "Incorrect", en: "Incorrect" },
  next: { bn: "Next", hi: "Next", en: "Next" },
  retake: { bn: "Retake", hi: "Retake", en: "Retake" },
  quizResult: { bn: "Result", hi: "Result", en: "Result" },

  noVideos: { bn: "No videos for this module", hi: "No videos for this module", en: "No videos for this module" },
  watchVideo: { bn: "Watch", hi: "Watch", en: "Watch" },

  overall: { bn: "Overall", hi: "Overall", en: "Overall" },
  modulesCompleted: { bn: "Modules Completed", hi: "Modules Completed", en: "Modules Completed" },
  quizzesTaken: { bn: "Quizzes Taken", hi: "Quizzes Taken", en: "Quizzes Taken" },
  badgesEarned: { bn: "Badges Earned", hi: "Badges Earned", en: "Badges Earned" },
  avgScore: { bn: "Avg Score", hi: "Avg Score", en: "Avg Score" },

  comingSoon: { bn: "Coming Soon", hi: "Coming Soon", en: "Coming Soon" },
  applyDesc: {
    bn: "Record how you applied electrical skills during field work.",
    hi: "Record how you applied electrical skills during field work.",
    en: "Record how you applied electrical skills during field work.",
  },

  quickActions: {
    bn: [
      { label: "MCB tripping", message: "Why does an MCB trip and how should I diagnose it safely?" },
      { label: "Socket burned", message: "A socket has burn marks. What should I check first?" },
      { label: "RCCB vs MCB", message: "Explain the difference between MCB and RCCB in simple words." },
      { label: "Wire size", message: "How do I choose wire size for a home circuit?" },
      { label: "Earthing", message: "Why is earthing important and how do I test it safely?" },
    ],
    hi: [
      { label: "MCB tripping", message: "Why does an MCB trip and how should I diagnose it safely?" },
      { label: "Socket burned", message: "A socket has burn marks. What should I check first?" },
      { label: "RCCB vs MCB", message: "Explain the difference between MCB and RCCB in simple words." },
      { label: "Wire size", message: "How do I choose wire size for a home circuit?" },
      { label: "Earthing", message: "Why is earthing important and how do I test it safely?" },
    ],
    en: [
      { label: "MCB tripping", message: "Why does an MCB trip and how should I diagnose it safely?" },
      { label: "Socket burned", message: "A socket has burn marks. What should I check first?" },
      { label: "RCCB vs MCB", message: "Explain the difference between MCB and RCCB in simple words." },
      { label: "Wire size", message: "How do I choose wire size for a home circuit?" },
      { label: "Earthing", message: "Why is earthing important and how do I test it safely?" },
    ],
  },

  langNames: { bn: "Bangla", hi: "Hindi", en: "English" },
  compulsory: { bn: "Foundation", hi: "Foundation", en: "Foundation" },
  elective: { bn: "Advanced", hi: "Advanced", en: "Advanced" },
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


