'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { api, ApiError } from '@/lib/api-client';
import type { PhoneLearner } from '@/lib/api-client';
import { t } from '@/lib/i18n/labels';
import { useStore } from '@/lib/store';
import { formatIndianPhone, normalizeIndianPhone } from '@/lib/phone';
import type { Lang } from '@/lib/types';

/**
 * Two-step phone + OTP gate. The server generates an OTP, stores only its hash,
 * and sets the Vajra Acharya session cookie after verification.
 */

type Step = 'phone' | 'otp';

const copy = {
  bn: {
    productLine: 'ইলেকট্রিক্যাল সেফটি ও ওয়্যারিং',
    signIn: 'ফোন দিয়ে সাইন ইন',
    mobile: 'মোবাইল নম্বর',
    invalidPhone: 'সঠিক ১০ সংখ্যার ভারতীয় মোবাইল নম্বর লিখুন।',
    genericError: 'কিছু ভুল হয়েছে। আবার চেষ্টা করুন।',
    sendOtp: 'OTP পাঠান',
    sending: 'পাঠানো হচ্ছে...',
    enterOtp: 'OTP লিখুন',
    sentTo: 'পাঠানো হয়েছে',
    pilotOtp: 'ডেভ টেস্ট OTP',
    otpValidity: 'OTP ১০ মিনিটের জন্য বৈধ।',
    verifying: 'যাচাই হচ্ছে...',
    verifyEnter: 'যাচাই করে ঢুকুন',
    differentNumber: '← অন্য নম্বর ব্যবহার করুন',
    couldNotVerify: 'যাচাই করা যায়নি। আবার চেষ্টা করুন।',
    otpDigit: 'OTP সংখ্যা',
  },
  hi: {
    productLine: 'इलेक्ट्रिकल सुरक्षा और वायरिंग',
    signIn: 'फोन से साइन इन',
    mobile: 'मोबाइल नंबर',
    invalidPhone: 'सही 10 अंकों का भारतीय मोबाइल नंबर डालें।',
    genericError: 'कुछ गलत हुआ। फिर से कोशिश करें।',
    sendOtp: 'OTP भेजें',
    sending: 'भेज रहा है...',
    enterOtp: 'OTP डालें',
    sentTo: 'भेजा गया',
    pilotOtp: 'डेव टेस्ट OTP',
    otpValidity: 'OTP 10 मिनट तक मान्य है।',
    verifying: 'जांच रहा है...',
    verifyEnter: 'जांच कर प्रवेश करें',
    differentNumber: '← दूसरा नंबर इस्तेमाल करें',
    couldNotVerify: 'जांच नहीं हो सकी। फिर से कोशिश करें।',
    otpDigit: 'OTP अंक',
  },
  en: {
    productLine: 'Electrical Safety & Wiring',
    signIn: 'Sign in with phone',
    mobile: 'Mobile number',
    invalidPhone: 'Enter a valid 10-digit Indian mobile number.',
    genericError: 'Something went wrong. Try again.',
    sendOtp: 'Send OTP',
    sending: 'Sending...',
    enterOtp: 'Enter OTP',
    sentTo: 'Sent to',
    pilotOtp: 'Dev test OTP',
    otpValidity: 'OTP is valid for 10 minutes.',
    verifying: 'Verifying...',
    verifyEnter: 'Verify & enter',
    differentNumber: '← Use a different number',
    couldNotVerify: 'Could not verify. Try again.',
    otpDigit: 'OTP digit',
  },
} as const;

export default function PhoneGate({ children }: { children: React.ReactNode }) {
  const { learnerId, userPhone, setUser, clearUser, setLang, lang } = useStore();
  // `checking` is the initial session probe — until it resolves we render a
  // blank splash so we don't flash the login form for already-signed-in users.
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>('phone');

  const [phoneInput, setPhoneInput] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const c = copy[lang];

  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // On mount, re-validate the server session cookie. If the cookie is valid,
  // zustand may or may not already have the user (first page load after a
  // reload wipes the in-memory store) — hydrate it from /me if needed.
  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (learnerId && userPhone) {
        // Trust the persisted store on a warm reload. The cookie is still
        // validated on every API call, so staleness can't escalate access.
        setChecking(false);
        return;
      }
      try {
        const me = await api.phoneAuth.me();
        if (cancelled) return;
        if (me) {
          setUser({
            learnerId: me.id,
            phone: me.phone,
            name: me.name,
            role: me.role === 'learner' ? 'user' : me.role,
            isAdmin: me.isAdmin,
          });
          if (me.preferredLang && ['bn', 'hi', 'en'].includes(me.preferredLang)) {
            setLang(me.preferredLang as Lang);
          }
        } else {
          // Server says no valid session — purge any stale identity that
          // localStorage might be persisting. Prevents fire-and-forget
          // calls (events, init, sync) from being rejected 401 before the
          // user has logged in fresh.
          clearUser();
        }
      } catch {
        /* treat any error as signed-out — keep the phone form visible */
        clearUser();
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    probe();
    return () => { cancelled = true; };
    // Intentionally run only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (learnerId && userPhone) return <>{children}</>;

  function storeUser(me: PhoneLearner) {
    setUser({
      learnerId: me.id,
      phone: me.phone,
      name: me.name,
      role: me.role === 'learner' ? 'user' : me.role,
      isAdmin: me.isAdmin,
    });
    if (me.preferredLang && ['bn', 'hi', 'en'].includes(me.preferredLang)) {
      setLang(me.preferredLang as Lang);
    }
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const normalized = normalizeIndianPhone(phoneInput);
    if (!normalized) {
      setErr(c.invalidPhone);
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.phoneAuth.requestOtp(normalized);
      setNormalizedPhone(normalized);
      setDevOtp(result.devOtp || null);
      setStep('otp');
      setOtpDigits(['', '', '', '', '', '']);
      // Focus the first OTP box on the next tick.
      setTimeout(() => otpInputs.current[0]?.focus(), 50);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : c.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== 6) return;
    setSubmitting(true);
    setErr('');
    try {
      const me = await api.phoneAuth.verifyOtp(normalizedPhone, otp);
      storeUser(me);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : c.couldNotVerify);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpInputs.current[0]?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  function setOtpDigitAt(idx: number, value: string) {
    const v = value.replace(/\D/g, '').slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    if (v && idx < 5) otpInputs.current[idx + 1]?.focus();
    // Auto-submit when all 6 filled (trigger after React flushes state).
    if (v && idx === 5) {
      setTimeout(() => {
        const full = otpDigits.slice();
        full[idx] = v;
        if (full.every((d) => d.length === 1)) submitOtp();
      }, 0);
    }
  }

  function onOtpKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpInputs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) otpInputs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) otpInputs.current[idx + 1]?.focus();
    if (e.key === 'Enter') submitOtp();
  }

  function onOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    text.split('').forEach((c, i) => { next[i] = c; });
    setOtpDigits(next);
    otpInputs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) setTimeout(() => submitOtp(), 0);
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-forest-deep p-6">
      <div className="w-full max-w-sm bg-paper rounded-[18px] p-7 border border-line shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <Avatar size={64} useImage />
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-gold mt-4">
            {t('appTraining', lang)}
          </p>
          <h1 className="font-serif italic text-3xl text-ink mt-1">{t('appName', lang)}</h1>
          <p className="text-xs text-muted mt-1">{c.productLine}</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={submitPhone}>
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted text-center mb-3">
              {c.signIn}
            </p>

            <label className="block">
              <span className="sr-only">{c.mobile}</span>
              <div className="flex items-stretch bg-cream border border-line rounded-xl overflow-hidden focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/20">
                <span className="px-3 flex items-center font-mono text-sm text-muted border-r border-line">
                  +91
                </span>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  pattern="[0-9 ]*"
                  maxLength={15}
                  autoFocus
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="90628 39387"
                  className="flex-1 bg-transparent px-3 py-3 font-mono text-[15px] text-ink placeholder:text-muted focus:outline-none"
                  aria-label={c.mobile}
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting || !phoneInput.trim()}
              className="w-full mt-4 py-3 bg-forest text-cream font-semibold rounded-xl text-sm hover:bg-forest-deep disabled:opacity-50 transition-colors"
            >
              {submitting ? c.sending : c.sendOtp}
            </button>

            {err && (
              <p className="text-terra text-xs text-center mt-3 font-medium">{err}</p>
            )}

            <p className="mt-6 text-center font-mono text-[9px] tracking-[0.22em] uppercase text-muted">
              v1 · {lang.toUpperCase()} · April 2026
            </p>
          </form>
        ) : (
          <form onSubmit={submitOtp}>
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted text-center mb-1">
              {c.enterOtp}
            </p>
            <p className="text-xs text-ink text-center mb-4">
              {c.sentTo} <span className="font-mono">{formatIndianPhone(normalizedPhone)}</span>
            </p>

            <div className="flex justify-center gap-2 mb-3">
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { otpInputs.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  pattern="[0-9]*"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setOtpDigitAt(i, e.target.value)}
                  onKeyDown={(e) => onOtpKeyDown(i, e)}
                  onPaste={onOtpPaste}
                  aria-label={`${c.otpDigit} ${i + 1}`}
                  className="w-11 h-12 lg:w-12 lg:h-14 bg-cream border border-line rounded-xl font-mono text-2xl text-ink text-center focus:outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
                />
              ))}
            </div>

            {devOtp ? (
              <p className="text-[11px] text-muted text-center mb-4">
                {c.pilotOtp} <span className="font-mono font-semibold text-forest">{devOtp}</span>
              </p>
            ) : (
              <p className="text-[11px] text-muted text-center mb-4">
                {c.otpValidity}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || otpDigits.some((d) => !d)}
              className="w-full py-3 bg-forest text-cream font-semibold rounded-xl text-sm hover:bg-forest-deep disabled:opacity-50 transition-colors"
            >
              {submitting ? c.verifying : c.verifyEnter}
            </button>

            <button
              type="button"
              onClick={() => { setStep('phone'); setErr(''); setDevOtp(null); }}
              className="w-full mt-2 py-2 text-muted hover:text-ink text-xs"
            >
              {c.differentNumber}
            </button>

            {err && (
              <p className="text-terra text-xs text-center mt-3 font-medium">{err}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
