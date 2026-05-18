import type { Lang } from "./types";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err || "");
}

export function errorCopy(err: unknown, lang: Lang): string {
  const status = (err as { status?: number })?.status;
  const message = errorMessage(err);

  if (/text-to-speech api is disabled/i.test(message)) {
    return lang === "bn"
      ? "ভয়েস চালু করতে Google Cloud Console-এ Cloud Text-to-Speech API enable করতে হবে।"
      : lang === "hi"
      ? "आवाज चलाने के लिए Google Cloud Console में Cloud Text-to-Speech API enable करना होगा।"
      : "Voice needs Cloud Text-to-Speech API enabled in Google Cloud Console.";
  }

  if (/gemini is busy|high demand|unavailable/i.test(message)) {
    return lang === "bn"
      ? "Gemini এখন ব্যস্ত আছে। এক মিনিট পরে আবার চেষ্টা করুন।"
      : lang === "hi"
      ? "Gemini अभी व्यस्त है। एक मिनट बाद फिर कोशिश करें।"
      : "Gemini is busy right now. Try again in a minute.";
  }

  if (status === 429) {
    return lang === "bn"
      ? "একটু ধীরে - ১০ সেকেন্ড অপেক্ষা করে আবার চেষ্টা করুন।"
      : lang === "hi"
      ? "जरा धीरे - 10 सेकंड रुककर फिर कोशिश करें।"
      : "Too many requests - wait about 10 seconds and try again.";
  }

  if (status === 504) {
    return lang === "bn"
      ? "উত্তর দিতে বেশি সময় লাগছে - ছোট প্রশ্ন পাঠান।"
      : lang === "hi"
      ? "जवाब देने में ज्यादा समय लग रहा है - छोटा सवाल भेजें।"
      : "Took too long - try a shorter question.";
  }

  if (status === 413) {
    return lang === "bn"
      ? "ছবি বা ডেটা খুব বড়। ছোট করে আবার পাঠান।"
      : lang === "hi"
      ? "तस्वीर या डेटा बहुत बड़ा है। छोटा करके फिर भेजें।"
      : "Image or data too large - try a smaller one.";
  }

  if (status === 401 || status === 403) {
    return lang === "bn"
      ? "অনুমতি নেই বা API key ঠিক নেই। সেটিংস চেক করুন।"
      : lang === "hi"
      ? "अनुमति नहीं है या API key सही नहीं है। सेटिंग्स जांचें।"
      : "Not authorized or API key is not configured correctly.";
  }

  if (status === 502 || status === 503) {
    return lang === "bn"
      ? "সার্ভিসে সমস্যা - একটু পরে আবার চেষ্টা করুন।"
      : lang === "hi"
      ? "सेवा में दिक्कत है - थोड़ी देर बाद फिर कोशिश करें।"
      : "Service error - try again in a moment.";
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return lang === "bn"
      ? "ইন্টারনেট নেই - সংযোগ চেক করুন।"
      : lang === "hi"
      ? "इंटरनेट नहीं है - कनेक्शन देखें।"
      : "You're offline - check your connection.";
  }

  return lang === "bn"
    ? "কোনও সমস্যা হয়েছে - আবার চেষ্টা করুন।"
    : lang === "hi"
    ? "कुछ दिक्कत हुई - फिर कोशिश करें।"
    : "Something went wrong - please try again.";
}
