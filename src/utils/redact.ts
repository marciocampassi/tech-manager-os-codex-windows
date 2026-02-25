export function redact(value: string): string {
  if (value.length <= 4) return '****';
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}
