const DRIVER_SEEN_NOTIFICATION_CATEGORY = 'driver_dispatch_seen';

function getTrucksFromDriverSeenMessage(message) {
  if (typeof message !== 'string') return [];
  const trucksSegment = message.match(/Trucks:\s*([^\n•]+)/i)?.[1];
  if (!trucksSegment) return [];
  return trucksSegment
    .split(',')
    .map((truck) => truck.trim())
    .filter(Boolean);
}

export function getNotificationTruckBadges(notification, fallbackTrucks = []) {
  if (notification?.notification_category !== DRIVER_SEEN_NOTIFICATION_CATEGORY) {
    return fallbackTrucks;
  }

  const requiredTrucks = Array.isArray(notification?.required_trucks)
    ? notification.required_trucks.map((truck) => String(truck || '').trim()).filter(Boolean)
    : [];

  const parsedMessageTrucks = getTrucksFromDriverSeenMessage(notification?.message);
  const preferredTrucks = requiredTrucks.length ? requiredTrucks : parsedMessageTrucks;
  return preferredTrucks.length ? [...new Set(preferredTrucks)] : fallbackTrucks;
}
