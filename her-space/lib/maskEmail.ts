export function maskEmail(email: string): string {
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator === email.length - 1) return email;
  const localPart = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  const maskedLocal = localPart.length <= 2
    ? `${localPart.charAt(0)}•••`
    : `${localPart.charAt(0)}•••${localPart.charAt(localPart.length - 1)}`;
  return `${maskedLocal}@${domain}`;
}
