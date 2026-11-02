import { describe, expect, it } from "vitest";
import { passwordStrength, validateEmail, validateLogin, validatePassword, validateUsername } from "@/lib/forms";

describe("sign-up validation (mirrors the Laravel rules)", () => {
  it("asks for a real email", () => {
    expect(validateEmail("")).toBe("Enter your email address.");
    expect(validateEmail("rider@")).toBe("That email address looks incomplete.");
    expect(validateEmail(" rider@cycleline.ch ")).toBeNull();
  });

  it("keeps usernames to 3–40 letters, numbers, dashes and underscores", () => {
    expect(validateUsername("ab")).toBe("Use at least 3 characters.");
    expect(validateUsername("a".repeat(41))).toBe("Use 40 characters or fewer.");
    expect(validateUsername("lazar m")).toBe("Use letters, numbers, - and _ only.");
    expect(validateUsername("lazar_m-1")).toBeNull();
  });

  it("needs 6 or more characters in a password", () => {
    expect(validatePassword("")).toBe("Enter a password.");
    expect(validatePassword("12345")).toBe("Use at least 6 characters.");
    expect(validatePassword("ride66")).toBeNull();
  });

  it("asks for the sign-in name", () => {
    expect(validateLogin("  ")).toBe("Enter your username or email.");
    expect(validateLogin("alexrider")).toBeNull();
  });
});

describe("password strength", () => {
  it("scores 0 for nothing and rises with length and variety", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("abc").score).toBe(1);
    expect(passwordStrength("ride66").score).toBe(2);
    expect(passwordStrength("RideTheAlps66").score).toBe(3);
    expect(passwordStrength("Ride the Alps in 2026!").score).toBe(4);
  });

  it("has a word for each score", () => {
    expect(passwordStrength("abc").label).toBe("Too short");
    expect(passwordStrength("Ride the Alps in 2026!").label).toBe("Strong");
  });
});
