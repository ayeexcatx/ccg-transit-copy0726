import {
  buildConfirmedTruckSetForStatus,
  uniqueTruckNumbers,
  parseStatusFromDispatchStatusKey,
  reconcileRequiredTruckList,
} from './confirmationStateHelpers';
import { NON_CONFIRMATION_NOTIFICATION_CATEGORIES } from './ownerActionStatus';

const parseStatusFromDedupKey = (notification) => parseStatusFromDispatchStatusKey(notification?.dispatch_status_key);
const normalizeId = (value) => String(value ?? '').trim();
const normalizeStatus = (value) => String(value ?? '').trim();

function parseRowTimestamp(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

const resolveRequiredTrucks = (notification, dispatch, ownerScopeTrucks = []) => {
  const baseRequired = Array.isArray(notification?.required_trucks)
    ? notification.required_trucks
    : [];

  const dispatchTrucks = uniqueTruckNumbers(dispatch?.trucks_assigned || []);
  const sourceRequired = baseRequired.length ? baseRequired : dispatchTrucks;
  if (!sourceRequired.length) return [];
  if (!ownerScopeTrucks?.length) {
    const dispatchTruckSet = new Set(dispatchTrucks);
    return sourceRequired.filter((truck) => dispatchTruckSet.has(truck));
  }

  return reconcileRequiredTruckList({
    existingRequired: sourceRequired,
    dispatchTrucks,
    ownerAllowedTrucks: ownerScopeTrucks,
  });
};

function collapseCompanyPendingRows(rows = []) {
  const grouped = new Map();

  (rows || []).forEach((row) => {
    const groupKey = [
      normalizeId(row.dispatchId),
      normalizeId(row.companyId),
      normalizeStatus(row.status),
      String(row.truckNumber || '').trim(),
    ].join(':');

    const existing = grouped.get(groupKey);
    if (!existing) {
      grouped.set(groupKey, row);
      return;
    }

    const existingTimestamp = parseRowTimestamp(existing.createdAt);
    const candidateTimestamp = parseRowTimestamp(row.createdAt);

    if (candidateTimestamp < existingTimestamp) {
      grouped.set(groupKey, {
        ...existing,
        id: row.id,
        notificationId: row.notificationId,
        createdAt: row.createdAt,
      });
    }
  });

  return [...grouped.values()];
}

export function buildOpenConfirmationRows({
  notifications = [],
  confirmations = [],
  dispatches = [],
  companies = [],
  accessCodes = [],
}) {
  const dispatchById = new Map(dispatches.map((dispatch) => [normalizeId(dispatch.id), dispatch]));
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const accessCodeById = new Map(accessCodes.map((accessCode) => [normalizeId(accessCode.id), accessCode]));

  const rows = [];

  notifications.forEach((notification) => {
    const isOwnerNotification = notification.recipient_type === 'AccessCode';
    const isConfirmationCategory = !NON_CONFIRMATION_NOTIFICATION_CATEGORIES.has(notification.notification_category);

    if (!isOwnerNotification || !isConfirmationCategory) return;

    const status = normalizeStatus(parseStatusFromDedupKey(notification));
    if (!status) return;

    const dispatch = dispatchById.get(normalizeId(notification.related_dispatch_id));
    if (!dispatch) return;
    if (normalizeStatus(dispatch.status) !== status) return;

    const ownerCodeId = normalizeId(notification.recipient_access_code_id || notification.recipient_id);
    const ownerCode = accessCodeById.get(ownerCodeId);
    if (ownerCode && ownerCode.code_type !== 'CompanyOwner') return;
    const ownerCompany = companyById.get(dispatch.company_id);
    const ownerScopeTrucks = Array.isArray(ownerCompany?.trucks) ? ownerCompany.trucks : [];

    const requiredTrucks = resolveRequiredTrucks(notification, dispatch, ownerScopeTrucks);
    if (!requiredTrucks.length) return;

    const confirmedTrucks = buildConfirmedTruckSetForStatus({
      confirmations,
      dispatchId: dispatch.id,
      status,
    });

    const pendingTrucks = requiredTrucks.filter((truckNumber) => !confirmedTrucks.has(truckNumber));
    if (!pendingTrucks.length) return;

    const companyName = companyById.get(dispatch.company_id)?.name || 'Unknown Company';

    pendingTrucks.forEach((truckNumber) => {
      rows.push({
        id: `${notification.id}:${truckNumber}`,
        notificationId: notification.id,
        dispatchId: dispatch.id,
        companyId: dispatch.company_id,
        status,
        companyName,
        dispatchDate: dispatch.date,
        truckNumber,
        clientName: dispatch.client_name || '',
        jobNumber: dispatch.job_number || '',
        referenceTag: dispatch.reference_tag || '',
        createdAt: notification.created_date || notification.created_at || null,
      });
    });
  });

  return collapseCompanyPendingRows(rows).sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}
