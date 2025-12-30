export class SimpleError extends Error {}

export function getFileNameExtension (s: string) : string | undefined {
   const p = s.lastIndexOf(".");
   return (p > 0) ? s.substring(p + 1) : undefined; }

export function decodeNumber (s: string) : number {
  const x = Number(s);
  if (!isFinite(x) || !s) {
     throw new SimpleError("Invalid numeric argument value \"" + s + "\"."); }
  return x; }

export function decodeInt (s: string) : number {
   const v = decodeNumber(s);
   if (!Number.isInteger(v)) {
     throw new SimpleError("Invalid integer argument value \"" + s + "\"."); }
   return v; }
