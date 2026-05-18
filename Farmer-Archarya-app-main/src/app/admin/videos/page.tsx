'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface ModRow { id: string; slug: string; title_en: string }
interface VideoRow {
  id: string;
  module_id: string;
  youtube_id: string;
  title_en: string;
  title_hi: string;
  title_bn: string;
  duration: string | null;
  start_seconds?: number | null;
  status?: string;
}

export default function AdminVideosPage() {
  const [modules, setModules] = useState<ModRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [form, setForm] = useState({ id: '', moduleId: '', youtubeId: '', titleEn: '', titleHi: '', titleBn: '', duration: '', status: 'published' });
  const [message, setMessage] = useState('');

  async function load() {
    const r = await fetch('/api/admin/videos', { credentials: 'same-origin' }).then((x) => x.json());
    setModules(r.modules || []);
    setVideos(r.videos || []);
    if (!form.moduleId && r.modules?.[0]) setForm((f) => ({ ...f, moduleId: r.modules[0].id }));
  }

  useEffect(() => {
    let alive = true;
    async function loadInitial() {
      const r = await fetch('/api/admin/videos', { credentials: 'same-origin' }).then((x) => x.json());
      if (!alive) return;
      setModules(r.modules || []);
      setVideos(r.videos || []);
      if (r.modules?.[0]) setForm((f) => f.moduleId ? f : { ...f, moduleId: r.modules[0].id });
    }
    void loadInitial();
    return () => { alive = false; };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const r = await fetch('/api/admin/videos', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      setMessage(form.id ? 'Video updated.' : form.status === 'published' ? 'Video saved and published in the app.' : 'Video saved as draft/review. Publish it to show it in the app.');
      setForm((f) => ({ ...f, id: '', youtubeId: '', titleEn: '', titleHi: '', titleBn: '', duration: '', status: 'published' }));
      await load();
    } else {
      setMessage((await r.json()).error || 'Save failed');
    }
  }

  function editVideo(video: VideoRow) {
    setMessage('');
    setForm({
      id: video.id,
      moduleId: video.module_id,
      youtubeId: video.start_seconds ? `https://youtu.be/${video.youtube_id}?t=${video.start_seconds}` : video.youtube_id,
      titleEn: video.title_en || '',
      titleHi: video.title_hi || '',
      titleBn: video.title_bn || '',
      duration: video.duration || '',
      status: video.status || 'published',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setForm((f) => ({ ...f, id: '', youtubeId: '', titleEn: '', titleHi: '', titleBn: '', duration: '', status: 'published' }));
    setMessage('');
  }

  function moduleLabel(moduleId: string) {
    const mod = modules.find((m) => m.id === moduleId);
    return mod ? `${mod.slug} - ${mod.title_en}` : moduleId;
  }

  async function deleteVideo(video: VideoRow) {
    if (!confirm(`Delete video "${video.title_en}"?`)) return;
    setMessage('');
    const r = await fetch(`/api/admin/videos?id=${encodeURIComponent(video.id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (r.ok) {
      setMessage('Video deleted.');
      await load();
    } else {
      setMessage((await r.json()).error || 'Delete failed');
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Tag tone="muted">CMS</Tag>
        <h1 className="font-serif italic text-4xl text-forest mt-2">Video editor</h1>
        <p className="text-sm text-muted mt-1">Add YouTube lessons with translation status and publish state.</p>
      </div>
      {message && <div className="mb-4 rounded-lg border border-line bg-cream px-4 py-2 text-sm">{message}</div>}
      <Card tone="surface" padding="lg" className="mb-6">
        {form.id && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-ink">
            <span>Editing video. Saving will update this row.</span>
            <button type="button" onClick={cancelEdit} className="font-semibold text-forest hover:underline">Cancel</button>
          </div>
        )}
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <select value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })} className="rounded-xl border border-line bg-cream px-3 py-2 text-sm">
            {modules.map((m) => <option key={m.id} value={m.id}>{m.slug} - {m.title_en}</option>)}
          </select>
          <input value={form.youtubeId} onChange={(e) => setForm({ ...form, youtubeId: e.target.value })} placeholder="YouTube link or ID" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} placeholder="English title" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <input value={form.titleHi} onChange={(e) => setForm({ ...form, titleHi: e.target.value })} placeholder="Hindi title" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <input value={form.titleBn} onChange={(e) => setForm({ ...form, titleBn: e.target.value })} placeholder="Bengali title" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Duration, e.g. 8:32" className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-xl border border-line bg-cream px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
          </select>
          <Button type="submit">{form.id ? 'Update video' : 'Save video'}</Button>
        </form>
      </Card>
      <Card tone="surface" padding="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {videos.map((v) => (
              <tr key={v.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{v.title_en}</td>
                <td className="px-3 py-3 text-xs text-muted">{moduleLabel(v.module_id)}</td>
                <td className="px-3 py-3 font-mono text-xs">{v.youtube_id}{v.start_seconds ? ` @ ${v.start_seconds}s` : ''}</td>
                <td className="px-3 py-3"><Tag tone={v.title_hi && v.title_bn ? 'forest' : 'terra'} filled>{v.title_hi && v.title_bn ? 'translated' : 'needs translation'}</Tag></td>
                <td className="px-3 py-3 text-right"><Tag tone={v.status === 'published' ? 'forest' : 'gold'} filled>{v.status || 'published'}</Tag></td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => editVideo(v)}
                    aria-label={`Edit ${v.title_en}`}
                    className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted hover:border-forest hover:bg-sage hover:text-forest"
                  >
                    <Icon name="pencil" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteVideo(v)}
                    aria-label={`Delete ${v.title_en}`}
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
