import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import DriverProtocolEditor from '@/components/protocols/DriverProtocolEditor';
import DriverProtocolContent from '@/components/protocols/DriverProtocolContent';
import {
  activeDriverProtocolQueryKey,
  ensureInitialDriverProtocol,
  getCurrentActiveDriverProtocol,
  publishDriverProtocolVersion,
} from '@/services/driverProtocolService';
import { useSession } from '@/components/session/SessionContext';

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return parsedDate.toLocaleString();
};

export default function AdminDriverProtocol() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [title, setTitle] = useState('OPERATIONS PROTOCOL');
  const [changeSummary, setChangeSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');

  const { data: activeProtocol = null, isLoading } = useQuery({
    queryKey: activeDriverProtocolQueryKey,
    queryFn: async () => {
      await ensureInitialDriverProtocol({ publishedByAccessCodeId: session?.id || null });
      return getCurrentActiveDriverProtocol();
    },
  });

  useEffect(() => {
    if (!activeProtocol) return;
    setTitle(activeProtocol.title || 'OPERATIONS PROTOCOL');
    setContentHtml(activeProtocol.content_html || '');
  }, [activeProtocol]);

  const nextVersionNumber = useMemo(() => {
    const currentVersion = Number(activeProtocol?.version_number || 0);
    return Number.isFinite(currentVersion) ? currentVersion + 1 : 1;
  }, [activeProtocol]);

  const publishMutation = useMutation({
    mutationFn: () => publishDriverProtocolVersion({
      title,
      contentHtml,
      changeSummary,
      publishedByAccessCodeId: session?.id || null,
    }),
    onSuccess: () => {
      toast.success('Driver Protocol published successfully.');
      setChangeSummary('');
      queryClient.invalidateQueries({ queryKey: activeDriverProtocolQueryKey });
      queryClient.invalidateQueries({ queryKey: ['admin-driver-protocol-acknowledgments'] });
    },
    onError: () => {
      toast.error('Unable to publish this protocol version right now.');
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card className="rounded-2xl border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">Driver Protocol</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          {isLoading && <p>Loading active protocol…</p>}
          {!isLoading && activeProtocol && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Current active version: {activeProtocol.version_number}</Badge>
              <span>Published: {formatDateTime(activeProtocol.published_at)}</span>
              {activeProtocol.change_summary && <span>Change summary: {activeProtocol.change_summary}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Create next protocol version</CardTitle>
            <p className="text-xs text-slate-500">Next publish will create Version {nextVersionNumber}.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="protocol-title">Title</Label>
              <Input id="protocol-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protocol-change-summary">Change summary (optional)</Label>
              <Textarea
                id="protocol-change-summary"
                rows={3}
                value={changeSummary}
                onChange={(event) => setChangeSummary(event.target.value)}
                placeholder="Summarize what changed in this version"
              />
            </div>
            <div className="space-y-2">
              <Label>Protocol content</Label>
              <DriverProtocolEditor value={contentHtml} onChange={setContentHtml} />
            </div>
            <Button
              onClick={() => {
                if (!window.confirm(`Publish Driver Protocol Version ${nextVersionNumber}?`)) return;
                publishMutation.mutate();
              }}
              className="bg-slate-900 hover:bg-slate-800"
              disabled={publishMutation.isPending || !contentHtml?.trim()}
            >
              {publishMutation.isPending ? 'Publishing…' : `Publish Version ${nextVersionNumber}`}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <DriverProtocolContent contentHtml={contentHtml} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
