import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function createProfileUrl(email: string): string {
  return email ? `https://www.gravatar.com/avatar/${Buffer.from(email).toString('hex')}?d=mp` : '';
}
