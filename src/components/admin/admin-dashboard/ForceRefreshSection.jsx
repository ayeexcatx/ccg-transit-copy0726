import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForceRefreshSection({
  isOpen,
  refreshAdminCode,
  refreshConfirmError,
  isPending,
  onOpen,
  onClose,
  onConfirm,
  onOpenChange,
  onCodeChange,
}) {
  return (
    <>
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-amber-900">Maintenance</h3>
            <p className="text-xs text-amber-800">Force all active sessions to reload and pick up the latest runtime version.</p>
          </div>
          <Button
            variant="outline"
            className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
            onClick={onOpen}
          >
            Force App Refresh
          </Button>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Confirm Forced Refresh
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to force app refresh now?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="refresh-admin-code">Enter an admin access code to confirm</Label>
            <Input
              id="refresh-admin-code"
              value={refreshAdminCode}
              onChange={(event) => onCodeChange(event.target.value)}
              placeholder="Admin access code"
              autoComplete="off"
            />
            {refreshConfirmError && <p className="text-sm text-red-600">{refreshConfirmError}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isPending || !refreshAdminCode.trim()}
            >
              {isPending ? 'Continuing…' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
