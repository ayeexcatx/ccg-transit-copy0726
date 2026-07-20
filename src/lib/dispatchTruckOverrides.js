const OVERRIDE_FIELDS = ['start_time', 'start_location', 'instructions', 'notes'];

const normalizeTruckNumber = (value) => String(value || '').trim();
const normalizeText = (value) => String(value || '').trim();

export function getTruckOverrides(dispatch) {
  if (!Array.isArray(dispatch?.truck_overrides)) return [];

  return dispatch.truck_overrides
    .map((entry) => ({
      truck_number: normalizeTruckNumber(entry?.truck_number),
      start_time: normalizeText(entry?.start_time),
      start_location: normalizeText(entry?.start_location),
      instructions: normalizeText(entry?.instructions),
      notes: normalizeText(entry?.notes),
    }))
    .filter((entry) => entry.truck_number);
}

export function getTruckOverride(dispatch, truckNumber) {
  const normalizedTruck = normalizeTruckNumber(truckNumber);
  if (!normalizedTruck) return null;

  return getTruckOverrides(dispatch).find((entry) => entry.truck_number === normalizedTruck) || null;
}

function getEffectiveOverrideField(dispatch, truckNumber, fieldName) {
  const override = getTruckOverride(dispatch, truckNumber);
  const overrideValue = normalizeText(override?.[fieldName]);
  if (overrideValue) return overrideValue;
  return normalizeText(dispatch?.[fieldName]);
}

export function getTruckOverrideField(dispatch, truckNumber, fieldName) {
  const override = getTruckOverride(dispatch, truckNumber);
  return normalizeText(override?.[fieldName]);
}

export function getEffectiveTruckStartTime(dispatch, truckNumber) {
  return getEffectiveOverrideField(dispatch, truckNumber, 'start_time');
}

export function getEffectiveTruckStartLocation(dispatch, truckNumber) {
  return getEffectiveOverrideField(dispatch, truckNumber, 'start_location');
}

export function getEffectiveTruckInstructions(dispatch, truckNumber) {
  return getEffectiveOverrideField(dispatch, truckNumber, 'instructions');
}

export function getEffectiveTruckNotes(dispatch, truckNumber) {
  return getEffectiveOverrideField(dispatch, truckNumber, 'notes');
}

export function hasMixedTruckStartTimes(dispatch, visibleTrucks = null) {
  const mainTime = normalizeText(dispatch?.start_time);
  const trucks = Array.isArray(visibleTrucks)
    ? visibleTrucks
    : (Array.isArray(dispatch?.trucks_assigned) ? dispatch.trucks_assigned : []);

  if (!trucks.length) return false;

  return trucks.some((truckNumber) => getEffectiveTruckStartTime(dispatch, truckNumber) !== mainTime);
}

export function hasMeaningfulTruckOverride(dispatch, truckNumber) {
  const override = getTruckOverride(dispatch, truckNumber);
  if (!override) return false;

  return OVERRIDE_FIELDS.some((fieldName) => {
    const overrideValue = normalizeText(override[fieldName]);
    if (!overrideValue) return false;
    return overrideValue !== normalizeText(dispatch?.[fieldName]);
  });
}

export function getMeaningfulTruckOverrides(dispatch, trucks = null) {
  const scope = Array.isArray(trucks) ? trucks : (Array.isArray(dispatch?.trucks_assigned) ? dispatch.trucks_assigned : []);
  return scope.filter((truckNumber) => hasMeaningfulTruckOverride(dispatch, truckNumber));
}
