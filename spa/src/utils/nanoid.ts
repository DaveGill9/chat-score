import { customAlphabet } from 'nanoid';

/**
 * Custom nanoid generator with 21 characters using numbers and lowercase letters only
 */
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 21);
const elementId = customAlphabet('abcdefghijklmnopqrstuvwxyz', 8);

/**
 * Generates a unique ID using nanoid with 21 characters
 * @returns A 16-character string containing only numbers and lowercase letters
 */
export function generateId(): string {
  return nanoid();
}

export function generateElementId(): string {
  return elementId();
}