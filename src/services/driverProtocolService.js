import { base44 } from '@/api/base44Client';
import { LEGACY_DRIVER_PROTOCOL_TITLE, buildLegacyDriverProtocolHtml } from '@/constants/driverProtocols';

const DRIVER_PROTOCOL_QUERY_LIMIT = 200;

const normalizeVersionNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 1) return 0;
  return Math.floor(numericValue);
};

export const activeDriverProtocolQueryKey = ['driver-protocol-active'];

export async function listDriverProtocols() {
  return base44.entities.DriverProtocol.list('-version_number', DRIVER_PROTOCOL_QUERY_LIMIT);
}

export async function getCurrentActiveDriverProtocol() {
  const activeRecords = await base44.entities.DriverProtocol.filter({ is_active: true }, '-version_number', 1);
  const activeRecord = activeRecords?.[0] || null;

  if (activeRecord) return activeRecord;

  return ensureInitialDriverProtocol();
}

export async function ensureInitialDriverProtocol({ publishedByAccessCodeId = null } = {}) {
  const existingProtocols = await listDriverProtocols();
  if (existingProtocols?.length) {
    const activeProtocol = existingProtocols.find((record) => record.is_active === true);
    if (activeProtocol) return activeProtocol;

    const latestProtocol = existingProtocols
      .slice()
      .sort((a, b) => normalizeVersionNumber(b.version_number) - normalizeVersionNumber(a.version_number))[0];

    await base44.entities.DriverProtocol.update(latestProtocol.id, { is_active: true });
    return { ...latestProtocol, is_active: true };
  }

  return base44.entities.DriverProtocol.create({
    title: LEGACY_DRIVER_PROTOCOL_TITLE,
    version_number: 1,
    content_html: buildLegacyDriverProtocolHtml(),
    change_summary: 'Initial protocol migrated from legacy hardcoded operations content.',
    published_at: new Date().toISOString(),
    published_by_access_code_id: publishedByAccessCodeId,
    is_active: true,
  });
}

export async function publishDriverProtocolVersion({ title, contentHtml, changeSummary, publishedByAccessCodeId }) {
  const existingProtocols = await listDriverProtocols();

  const nextVersion = existingProtocols.length
    ? Math.max(...existingProtocols.map((record) => normalizeVersionNumber(record.version_number))) + 1
    : 1;

  const activeProtocol = existingProtocols.find((record) => record.is_active === true);
  if (activeProtocol?.id) {
    await base44.entities.DriverProtocol.update(activeProtocol.id, { is_active: false });
  }

  return base44.entities.DriverProtocol.create({
    title: title?.trim() || LEGACY_DRIVER_PROTOCOL_TITLE,
    version_number: nextVersion,
    content_html: contentHtml,
    change_summary: changeSummary?.trim() || null,
    published_at: new Date().toISOString(),
    published_by_access_code_id: publishedByAccessCodeId || null,
    is_active: true,
  });
}

export async function getDriverProtocolAcknowledgmentForVersion({ driverId, driverProtocolId }) {
  if (!driverId || !driverProtocolId) return null;

  const acknowledgmentRecords = await base44.entities.DriverProtocolAcknowledgment.filter(
    {
      driver_id: driverId,
      driver_protocol_id: driverProtocolId,
    },
    '-accepted_at',
    1,
  );

  return acknowledgmentRecords?.[0] || null;
}

export async function getLatestDriverProtocolAcknowledgment({ driverId }) {
  if (!driverId) return null;

  const acknowledgmentRecords = await base44.entities.DriverProtocolAcknowledgment.filter(
    { driver_id: driverId },
    '-accepted_at',
    1,
  );

  return acknowledgmentRecords?.[0] || null;
}

export async function getCurrentDriverProtocolAcknowledgment(driverId) {
  if (!driverId) return null;
  const activeProtocol = await getCurrentActiveDriverProtocol();
  if (!activeProtocol?.id) return null;

  return getDriverProtocolAcknowledgmentForVersion({ driverId, driverProtocolId: activeProtocol.id });
}

export async function acknowledgeCurrentDriverProtocol({
  driverId,
  companyId,
  acceptedByAccessCodeId,
}) {
  if (!driverId) {
    throw new Error('Driver is required to acknowledge protocols.');
  }

  const activeProtocol = await getCurrentActiveDriverProtocol();
  if (!activeProtocol?.id) {
    throw new Error('No active driver protocol is currently available.');
  }

  const existingAcknowledgment = await getDriverProtocolAcknowledgmentForVersion({
    driverId,
    driverProtocolId: activeProtocol.id,
  });

  if (existingAcknowledgment) return existingAcknowledgment;

  return base44.entities.DriverProtocolAcknowledgment.create({
    driver_id: driverId,
    company_id: companyId || null,
    driver_protocol_id: activeProtocol.id,
    protocol_version: activeProtocol.version_number,
    accepted_at: new Date().toISOString(),
    accepted_by_access_code_id: acceptedByAccessCodeId || null,
  });
}
