'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface ModRow { id: string; slug: string; title_en: string }
interface QRow {
  id: string;
  module_id: string;
  question_en: string;
  question_hi?: string;
  question_bn?: string;
  options_en: string[];
  options_hi?: string[];
  options_bn?: string[];
  correct_index: number;
  explanation_en?: string;
  explanation_hi?: string;
  explanation_bn?: string;
  status: string;
}

export default function AdminQuizzesPage() {
  const [modules, setModules] = useState<ModRow[]>([]);
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [form, setForm] = useState({
    id: '', moduleId: '', questionEn: '', questionHi: '', questionBn: '', optionsEn: '', optionsHi: '', optionsBn: '',
    correctIndex: 0, explanationEn: '', explanationHi: '', explanationBn: '', status: 'draft',
  });
  const [message, setMessage] = useState('');

  async function load() {
    const r = await fetch('/api/admin/quizzes', { credentials: 'same-origin' }).then((x) => x.json());
    setModules(r.modules || []);
    setQuestions(r.questions || []);
    if (!form.moduleId && r.modules?.[0]) setForm((f) => ({ ...f, moduleId: r.modules[0].id }));
  }

  useEffect(() => {
    let alive = true;
    async function loadInitial() {
      const r = await fetch('/api/admin/quizzes', { credentials: 'same-origin' }).then((x) => x.json());
      if (!alive) return;
      setModules(r.modules || []);
      setQuestions(r.questions || []);
      if (r.modules?.[0]) setForm((f) => f.moduleId ? f : { ...f, moduleId: r.modules[0].id });
    }
    void loadInitial();
    return () => { alive = false; };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/admin/quizzes', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (r.ok) {
      setMessage(form.id ? 'Question updated.' : 'Question saved.');
      setForm((f) => ({ ...f, id: '', questionEn: '', questionHi: '', questionBn: '', optionsEn: '', optionsHi: '', optionsBn: '', explanationEn: '', explanationHi: '', explanationBn: '', correctIndex: 0, status: 'draft' }));
      await load();
    } else {
      setMessage((await r.json()).error || 'Save failed');
    }
  }

  function editQuestion(question: QRow) {
    setMessage('');
    setForm({
      id: question.id,
      moduleId: question.module_id,
      questionEn: question.question_en || '',
      questionHi: question.question_hi || '',
      questionBn: question.question_bn || '',
      optionsEn: (question.options_en || []).join('\n'),
      optionsHi: (question.options_hi || []).join('\n'),
      optionsBn: (question.options_bn || []).join('\n'),
      correctIndex: question.correct_index || 0,
      explanationEn: question.explanation_en || '',
      explanationHi: question.explanation_hi || '',
      explanationBn: question.explanation_bn || '',
      status: question.status || 'draft',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setForm((f) => ({ ...f, id: '', questionEn: '', questionHi: '', questionBn: '', optionsEn: '', optionsHi: '', optionsBn: '', explanationEn: '', explanationHi: '', explanationBn: '', correctIndex: 0, status: 'draft' }));
    setMessage('');
  }

  async function deleteQuestion(question: QRow) {
    if (!confirm(`Delete quiz question "${question.question_en}"?`)) return;
    setMessage('');
    const r = await fetch(`/api/admin/quizzes?id=${encodeURIComponent(question.id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (r.ok) {
      setMessage('Question deleted.');
      await load();
    } else {
      setMessage((await r.json()).error || 'Delete failed');
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Tag tone="muted">CMS</Tag>
        <h1 className="font-serif italic text-4xl text-forest mt-2">Quiz editor</h1>
        <p className="text-sm text-muted mt-1">Create reviewed question-bank items for future fixed quizzes.</p>
      </div>
      {message && <div className="mb-4 rounded-lg border border-line bg-cream px-4 py-2 text-sm">{message}</div>}
      <Card tone="surface" padding="lg" className="mb-6">
        {form.id && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-ink">
            <span>Editing question. Saving will update this row.</span>
            <button type="button" onClick={cancelEdit} className="font-semibold text-forest hover:underline">Cancel</button>
          </div>
        )}
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <select value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })} className="rounded-xl border border-line bg-cream px-3 py-2 text-sm">
            {modules.map((m) => <option key={m.id} value={m.id}>{m.slug} - {m.title_en}</option>)}
          </select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-xl border border-line bg-cream px-3 py-2 text-sm">
            <option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option>
          </select>
          <textarea value={form.questionEn} onChange={(e) => setForm({ ...form, questionEn: e.target.value })} placeholder="English question" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <textarea value={form.optionsEn} onChange={(e) => setForm({ ...form, optionsEn: e.target.value })} placeholder="English options, one per line" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <textarea value={form.questionHi} onChange={(e) => setForm({ ...form, questionHi: e.target.value })} placeholder="Hindi question" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <textarea value={form.questionBn} onChange={(e) => setForm({ ...form, questionBn: e.target.value })} placeholder="Bengali question" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <input type="number" value={form.correctIndex} onChange={(e) => setForm({ ...form, correctIndex: Number(e.target.value) })} placeholder="Correct option index" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <input value={form.explanationEn} onChange={(e) => setForm({ ...form, explanationEn: e.target.value })} placeholder="English explanation" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <Button type="submit">{form.id ? 'Update question' : 'Save question'}</Button>
        </form>
      </Card>
      <Card tone="surface" padding="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{q.question_en}</td>
                <td className="px-3 py-3"><Tag tone={q.question_hi && q.question_bn ? 'forest' : 'terra'} filled>{q.question_hi && q.question_bn ? 'translated' : 'needs translation'}</Tag></td>
                <td className="px-3 py-3 text-right"><Tag tone={q.status === 'published' ? 'forest' : 'gold'} filled>{q.status}</Tag></td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => editQuestion(q)}
                    aria-label={`Edit ${q.question_en}`}
                    className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted hover:border-forest hover:bg-sage hover:text-forest"
                  >
                    <Icon name="pencil" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(q)}
                    aria-label={`Delete ${q.question_en}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted hover:border-terra hover:bg-terra/10 hover:text-terra"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
