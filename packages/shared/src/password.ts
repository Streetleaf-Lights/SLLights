/**
 * The web's password rules for setting a password (Register / Set your
 * password, and Reset your password): at least 8 characters including at
 * least 1 special character, entered twice to match.
 */
export const PASSWORD_MIN_LENGTH = 8;
const SPECIAL_CHAR_PATTERN = /[^A-Za-z0-9]/;

export interface PasswordChecks {
  hasMinLength: boolean;
  hasSpecialChar: boolean;
  /** Both rules met. */
  valid: boolean;
  /** The confirmation has been typed and equals the password. */
  matches: boolean;
}

export function checkNewPassword(password: string, confirmation: string): PasswordChecks {
  const hasMinLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasSpecialChar = SPECIAL_CHAR_PATTERN.test(password);
  return {
    hasMinLength,
    hasSpecialChar,
    valid: hasMinLength && hasSpecialChar,
    matches: confirmation.length > 0 && password === confirmation,
  };
}
