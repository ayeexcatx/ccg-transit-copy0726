import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUserLookup() {
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-lookup'],
    queryFn: () => base44.entities.User.list(),
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q) ||
      (u.data?.app_display_name || '').toLowerCase().includes(q)
    );
  });

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success('User ID copied');
  };

  const getRoleLabel = (u) => u.data?.app_role || u.role || '—';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">User ID Lookup</h2>
        <p className="text-sm text-slate-500 mt-0.5">Search users and copy their record ID for manual account linking.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search by name, email, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-700 rounded-full" />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Role</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">User Record ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400 text-sm">No users found</td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{u.full_name || '—'}</div>
                      {u.data?.app_display_name && u.data.app_display_name !== u.full_name && (
                        <div className="text-xs text-slate-500">{u.data.app_display_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{u.email || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">{getRoleLabel(u)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyId(u.id)}
                        className="flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 transition-colors group"
                        title="Click to copy"
                      >
                        <span>{u.id}</span>
                        <Copy className="h-3 w-3 text-slate-400 group-hover:text-slate-600 shrink-0" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}