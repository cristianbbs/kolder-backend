export function generateProvisionalPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from({length: len}).map(() => chars[Math.floor(Math.random()*chars.length)]).join('');
}
