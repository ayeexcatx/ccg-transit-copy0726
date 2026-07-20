import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BellRing } from 'lucide-react';

export default function AvailabilityRequestPrompt({ onGoToAvailability, onDismiss }) {
  return (
    <Card className="border-amber-300/90 bg-gradient-to-br from-amber-50 via-amber-50 to-orange-50 shadow-sm ring-1 ring-amber-200/70">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-100 p-1.5 ring-1 ring-amber-200/80">
            <BellRing className="h-4 w-4 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-sm font-semibold text-amber-950">Your availability has been requested.</p>
              <p className="mt-1 text-sm text-amber-900/90">Please update your truck count in the calendar section to update your availability.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onGoToAvailability}>Go to Availability</Button>
              <Button size="sm" variant="outline" onClick={onDismiss}>Later</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
