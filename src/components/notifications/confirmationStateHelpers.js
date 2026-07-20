/**
 * Parse dispatch status from a dispatch_status_key shaped like:
 * `${dispatchId}:${status}:${recipientId}`
 */
export function parseStatusFromDispatchStatusKey(dispatchStatusKey) {
  const parts = String(dispatchStatusKey || '').split(':');
  return parts.length >= 2 ? parts[1] : '';
}

function normalizeTruckNumber(truck) {
  return String(truck || '').trim();
}

/**
 * Return unique truthy truck numbers while preserving first-seen order.
 */
export function uniqueTruckNumbers(trucks = []) {
  const seen = new Set();
  return (trucks || []).reduce((result, truck) => {
    const normalizedTruck = normalizeTruckNumber(truck);
    if (!normalizedTruck || seen.has(normalizedTruck)) return result;
    seen.add(normalizedTruck);
    result.push(normalizedTruck);
    return result;
  }, []);
}

/**
 * Build a set of confirmed trucks for a specific dispatch + confirmation_type.
 */
export function buildConfirmedTruckSetForStatus({
  confirmations = [],
  dispatchId,
  status,
}) {
  const normalizedDispatchId = String(dispatchId || '').trim();
  const normalizedStatus = String(status || '').trim();
  return new Set(
    (confirmations || [])
      .filter((confirmation) => (
        String(confirmation.dispatch_id || '').trim() === normalizedDispatchId &&
        String(confirmation.confirmation_type || '').trim() === normalizedStatus &&
        normalizeTruckNumber(confirmation?.truck_number)
      ))
      .map((confirmation) => normalizeTruckNumber(confirmation.truck_number))
  );
}

/**
 * Return confirmation rows matching a specific dispatch + status.
 */
export function getConfirmationsForDispatchStatus({
  confirmations = [],
  dispatchId,
  status,
}) {
  return (confirmations || []).filter((confirmation) =>
    confirmation.dispatch_id === dispatchId &&
    confirmation.confirmation_type === status
  );
}

/**
 * Derive confirmed/pending truck lists and summary counters.
 */
export function deriveConfirmationCoverage(requiredTrucks = [], confirmedTruckSet = new Set()) {
  const confirmedTrucks = (requiredTrucks || []).filter((truck) => confirmedTruckSet.has(truck));
  const pendingTrucks = (requiredTrucks || []).filter((truck) => !confirmedTruckSet.has(truck));
  const total = (requiredTrucks || []).length;
  const done = confirmedTrucks.length;
  const allConfirmed = pendingTrucks.length === 0;

  return {
    confirmedTrucks,
    pendingTrucks,
    total,
    done,
    allConfirmed,
  };
}

/**
 * Determine whether all required trucks are present in the confirmed set.
 */
export function areAllRequiredTrucksConfirmed(requiredTrucks = [], confirmedTruckSet = new Set()) {
  return (requiredTrucks || []).every((truck) => confirmedTruckSet.has(normalizeTruckNumber(truck)));
}

/**
 * Expand required trucks by appending newly eligible trucks.
 */
export function expandRequiredTruckList(existingRequired = [], addedTrucks = []) {
  return uniqueTruckNumbers([...(existingRequired || []), ...(addedTrucks || [])]);
}

/**
 * Keep required trucks limited to currently assigned + owner-allowed trucks.
 */
export function reconcileRequiredTruckList({
  existingRequired = [],
  dispatchTrucks = [],
  ownerAllowedTrucks = [],
}) {
  const currentDispatchTrucks = new Set((dispatchTrucks || []).map(normalizeTruckNumber).filter(Boolean));
  const allowedTrucks = new Set((ownerAllowedTrucks || []).map(normalizeTruckNumber).filter(Boolean));

  return (existingRequired || []).filter((truck) =>
    currentDispatchTrucks.has(normalizeTruckNumber(truck)) && allowedTrucks.has(normalizeTruckNumber(truck))
  );
}
