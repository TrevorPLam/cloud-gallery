// Simple CAPTCHA system for Cloud Gallery
// Provides math-based CAPTCHA to prevent automated attacks

import { randomBytes } from "crypto";

export interface CaptchaChallenge {
  id: string;
  question: string;
  answer: number;
  expiresAt: number;
}

// In-memory store for CAPTCHA challenges (replace with Redis in production)
const captchaStore = new Map<string, CaptchaChallenge>();

/**
 * Generate a simple math CAPTCHA challenge
 *
 * @returns CAPTCHA challenge object
 *
 * @example
 * const challenge = generateCaptcha();
 * console.log(challenge.question); // "What is 7 + 3?"
 * console.log(challenge.answer); // 10
 */
export function generateCaptcha(): CaptchaChallenge {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operations = ["+", "-"];
  const operation = operations[Math.floor(Math.random() * operations.length)];

  let answer: number;
  let question: string;

  switch (operation) {
    case "+":
      answer = num1 + num2;
      question = `What is ${num1} + ${num2}?`;
      break;
    case "-":
      // Ensure positive result
      let finalNum1 = num1;
      let finalNum2 = num2;
      if (finalNum1 < finalNum2) {
        [finalNum1, finalNum2] = [finalNum2, finalNum1];
      }
      answer = finalNum1 - finalNum2;
      question = `What is ${finalNum1} - ${finalNum2}?`;
      break;
    default:
      answer = num1 + num2;
      question = `What is ${num1} + ${num2}?`;
  }

  const id = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  const challenge: CaptchaChallenge = {
    id,
    question,
    answer,
    expiresAt,
  };

  // Store the challenge
  captchaStore.set(id, challenge);

  // Clean up expired challenges
  cleanupExpiredChallenges();

  return challenge;
}

/**
 * Verify a CAPTCHA answer
 *
 * @param id - CAPTCHA challenge ID
 * @param answer - User's answer
 * @returns true if answer is correct and not expired
 *
 * @example
 * const isValid = verifyCaptcha(challenge.id, userAnswer);
 * if (isValid) {
 *   // Allow the request to proceed
 * }
 */
export function verifyCaptcha(id: string, answer: number): boolean {
  const challenge = captchaStore.get(id);

  if (!challenge) {
    return false; // Challenge not found
  }

  if (Date.now() > challenge.expiresAt) {
    captchaStore.delete(id); // Clean up expired challenge
    return false; // Challenge expired
  }

  if (challenge.answer !== answer) {
    return false; // Wrong answer
  }

  // Remove used challenge
  captchaStore.delete(id);
  return true;
}

/**
 * Clean up expired CAPTCHA challenges
 */
function cleanupExpiredChallenges(): void {
  const now = Date.now();
  for (const [id, challenge] of captchaStore.entries()) {
    if (now > challenge.expiresAt) {
      captchaStore.delete(id);
    }
  }
}

/**
 * Get CAPTCHA challenge by ID (for testing)
 *
 * @param id - CAPTCHA challenge ID
 * @returns CAPTCHA challenge or null if not found
 */
export function getCaptchaChallenge(id: string): CaptchaChallenge | null {
  const challenge = captchaStore.get(id);
  if (!challenge || Date.now() > challenge.expiresAt) {
    return null;
  }
  return challenge;
}

/**
 * Clear all CAPTCHA challenges (for testing)
 */
export function clearAllCaptchas(): void {
  captchaStore.clear();
}
