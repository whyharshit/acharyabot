'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';

type AdminRole = 'founder' | 'admin' | 'editor';
type UserRole = 'learner' | 'admin' | 'founder';

interface Account {
  id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
}

interface UserRow {
  id: string;
  phone: string;
  name: string | null;
  role: string;
  is_admin: boolean;
  preferred_lang: string;
  last_seen_on: string | null;
}

export default function AdminRolesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api.admin.roles();
      setAccounts(r.accounts);
      setUsers(r.users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    async function loadInitial() {
      setLoading(true);
      try {
        const r = await api.admin.roles();
        if (!alive) return;
        setAccounts(r.accounts);
        setUsers(r.users);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void loadInitial();
    return () => { alive = false; };
  }, []);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      await api.admin.upsertAdminAccount({ email, password, role, isActive: true });
      setEmail('');
      setPassword('');
      setRole('admin');
      setMessage('Admin account saved.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save account');
    }
  }

  async function setUserRole(userId: string, nextRole: UserRole) {
    await api.admin.updateUserRole(userId, nextRole);
    await load();
  }

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Tag tone="muted">Access</Tag>
        <h1 className="font-serif italic text-4xl text-forest mt-2">Admin roles</h1>
        <p className="text-sm text-muted mt-1">Supabase-backed admin accounts and learner role promotion.</p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-line bg-cream px-4 py-2 text-sm text-ink">{message}</div>
      )}

      <div className="grid lg:grid-cols-[360px_1fr] gap-5">
        <Card tone="surface" padding="lg">
          <Tag tone="forest" filled>Admin credentials</Tag>
          <form onSubmit={saveAccount} className="mt-4 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="editor@example.com"
              required
              className="w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password for new/reset account"
              className="w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
            >
              <option value="founder">Founder</option>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
            </select>
            <Button type="submit" fullWidth>Save admin account</Button>
          </form>
        </Card>

        <Card tone="surface" padding="none" className="overflow-hidden">
          <div className="px-4 py-3 bg-cream border-b border-line">
            <Tag tone="muted">Admin accounts</Tag>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink">{a.email}</td>
                  <td className="px-3 py-3"><Tag tone="forest" filled>{a.role}</Tag></td>
                  <td className="px-3 py-3 text-xs text-muted">{a.is_active ? 'active' : 'disabled'}</td>
                  <td className="px-4 py-3 text-right font-mono text-[11px] text-muted">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td className="px-4 py-8 text-center text-muted italic">No Supabase admin accounts yet. Env login still works as bootstrap.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Card tone="surface" padding="none" className="overflow-hidden mt-6">
        <div className="px-4 py-3 bg-cream border-b border-line">
          <Tag tone="muted">Phone users</Tag>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper">
                <th className="text-left px-4 py-2 font-mono text-[10px] uppercase text-muted">User</th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted">Lang</th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted">Role</th>
                <th className="text-right px-4 py-2 font-mono text-[10px] uppercase text-muted">Change</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{u.name || 'Pilot farmer'}</p>
                    <p className="font-mono text-[11px] text-muted">{u.phone}</p>
                  </td>
                  <td className="px-3 py-3">{u.preferred_lang}</td>
                  <td className="px-3 py-3"><Tag tone={u.is_admin ? 'forest' : 'muted'} filled>{u.role}</Tag></td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={(u.role === 'admin' || u.role === 'founder') ? u.role : 'learner'}
                      onChange={(e) => setUserRole(u.id, e.target.value as UserRole)}
                      className="rounded-lg border border-line bg-cream px-2 py-1 text-xs"
                    >
                      <option value="learner">Learner</option>
                      <option value="admin">Admin</option>
                      <option value="founder">Founder</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
