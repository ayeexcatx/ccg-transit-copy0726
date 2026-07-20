import {
  acknowledgeCurrentDriverProtocol,
  getCurrentActiveDriverProtocol,
  getCurrentDriverProtocolAcknowledgment,
} from '@/services/driverProtocolService';

export const driverProtocolAckQueryKey = (driverId, protocolVersion = 'active') => [
  'driver-protocol-acknowledgment',
  driverId,
  protocolVersion,
];

export async function getDriverProtocolAcknowledgment(driverId) {
  return getCurrentDriverProtocolAcknowledgment(driverId);
}

export async function getDriverProtocolState(driverId) {
  const activeProtocol = await getCurrentActiveDriverProtocol();
  const acknowledgment = driverId
    ? await getCurrentDriverProtocolAcknowledgment(driverId)
    : null;

  return {
    activeProtocol,
    acknowledgment,
  };
}

export async function createDriverProtocolAcknowledgment({ driverId, companyId, acceptedByAccessCodeId }) {
  return acknowledgeCurrentDriverProtocol({
    driverId,
    companyId,
    acceptedByAccessCodeId,
  });
}
