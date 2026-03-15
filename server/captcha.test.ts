// CAPTCHA system tests for Cloud Gallery

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCaptcha, verifyCaptcha, clearAllCaptchas } from "./captcha";

describe("CAPTCHA System", () => {
  beforeEach(() => {
    clearAllCaptchas();
  });

  it("should generate a valid CAPTCHA challenge", () => {
    const challenge = generateCaptcha();

    expect(challenge).toHaveProperty("id");
    expect(challenge).toHaveProperty("question");
    expect(challenge).toHaveProperty("answer");
    expect(challenge).toHaveProperty("expiresAt");

    expect(typeof challenge.id).toBe("string");
    expect(typeof challenge.question).toBe("string");
    expect(typeof challenge.answer).toBe("number");
    expect(typeof challenge.expiresAt).toBe("number");

    // Check that the question is a math problem
    expect(challenge.question).toMatch(/^What is \d+ [+-] \d+\?$/);

    // Check that expiration is in the future
    expect(challenge.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should verify correct CAPTCHA answer", () => {
    const challenge = generateCaptcha();
    const isValid = verifyCaptcha(challenge.id, challenge.answer);

    expect(isValid).toBe(true);
  });

  it("should reject incorrect CAPTCHA answer", () => {
    const challenge = generateCaptcha();
    const wrongAnswer = challenge.answer + 1;
    const isValid = verifyCaptcha(challenge.id, wrongAnswer);

    expect(isValid).toBe(false);
  });

  it("should reject non-existent CAPTCHA ID", () => {
    const isValid = verifyCaptcha("non-existent-id", 123);

    expect(isValid).toBe(false);
  });

  it("should reject expired CAPTCHA", () => {
    const challenge = generateCaptcha();

    // Mock the expiration time to be in the past
    challenge.expiresAt = Date.now() - 1000;

    const isValid = verifyCaptcha(challenge.id, challenge.answer);

    expect(isValid).toBe(false);
  });

  it("should generate different math operations", () => {
    const challenges = [];
    for (let i = 0; i < 20; i++) {
      challenges.push(generateCaptcha());
    }

    const hasAddition = challenges.some((c) => c.question.includes("+"));
    const hasSubtraction = challenges.some((c) => c.question.includes("-"));

    expect(hasAddition).toBe(true);
    expect(hasSubtraction).toBe(true);
  });

  it("should ensure subtraction results are positive", () => {
    const challenges = [];
    for (let i = 0; i < 50; i++) {
      challenges.push(generateCaptcha());
    }

    const subtractionChallenges = challenges.filter((c) =>
      c.question.includes("-"),
    );

    for (const challenge of subtractionChallenges) {
      // Extract numbers from the question
      const matches = challenge.question.match(/(\d+) - (\d+)/);
      if (matches) {
        const num1 = parseInt(matches[1]);
        const num2 = parseInt(matches[2]);
        const result = num1 - num2;

        // Result should match the answer and be non-negative
        expect(result).toBe(challenge.answer);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("should not allow reuse of CAPTCHA", () => {
    const challenge = generateCaptcha();

    // First verification should succeed
    const firstAttempt = verifyCaptcha(challenge.id, challenge.answer);
    expect(firstAttempt).toBe(true);

    // Second verification should fail
    const secondAttempt = verifyCaptcha(challenge.id, challenge.answer);
    expect(secondAttempt).toBe(false);
  });
});
