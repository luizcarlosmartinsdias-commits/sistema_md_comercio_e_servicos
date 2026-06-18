export const IMEI_LENGTH = 15;

export function normalizeImei(value: string) {
  return value.replace(/\D/g, '').slice(0, IMEI_LENGTH);
}

export function isValidImei(value: string) {
  return normalizeImei(value).length === IMEI_LENGTH;
}

export function requireValidImei(value: string) {
  const imei = normalizeImei(value);
  if (imei.length !== IMEI_LENGTH) {
    throw new Error('O IMEI deve conter exatamente 15 algarismos numericos.');
  }
  return imei;
}
