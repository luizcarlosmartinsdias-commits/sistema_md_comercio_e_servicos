export async function nextProtocol() {
  const year = new Date().getFullYear();
  const number = Date.now() % 100000;
  const suffix = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `MD-${year}-${String(number).padStart(5, '0')}${suffix}`;
}
