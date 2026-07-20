import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function DeleteConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isDeleting = false,
  requireAdminAccessCode = false,
  adminAccessCode = '',
  onAdminAccessCodeChange = () => {},
  adminAccessCodeError = '',
}) {
  const isConfirmDisabled = isDeleting || (requireAdminAccessCode && !String(adminAccessCode || '').trim());

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {requireAdminAccessCode && (
          <div className="space-y-1.5">
            <Label htmlFor="delete-admin-access-code">Admin Access Code</Label>
            <Input
              id="delete-admin-access-code"
              value={adminAccessCode}
              onChange={(event) => onAdminAccessCodeChange(event.target.value)}
              placeholder="Enter your access code"
              className={adminAccessCodeError ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {adminAccessCodeError && <p className="text-xs text-red-500">{adminAccessCodeError}</p>}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
