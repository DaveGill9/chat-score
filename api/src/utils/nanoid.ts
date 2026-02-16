import { customAlphabet } from 'nanoid';

// Define your custom alphabet and length
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const LENGTH = 21; 

// URL-safe ID generator
export const generateId = customAlphabet(ALPHABET, LENGTH);

// Export the default nanoid function for backward compatibility
export { nanoid } from 'nanoid'; 