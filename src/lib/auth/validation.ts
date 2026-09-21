export type ErrorCode =
  | 'required'
  | 'tooLong'
  | 'loginFormat'
  | 'email'
  | 'passwordShort'
  | 'passwordWeak'
  | 'emailTaken'
  | 'loginTaken'
  | 'badCredentials'
  | 'network'
  | 'unknown';

export type Field = 'firstName' | 'lastName' | 'login' | 'email' | 'password';

export interface SignUpValues {
  firstName: string;
  lastName: string;
  login: string;
  email: string;
  password: string;
}

export const LOGIN_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 40;
const MIN_PASSWORD = 6;

export function normalizeLogin(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

export function validateName(value: string): ErrorCode | null {
  const v = value.trim();
  if (v === '') return 'required';
  if (v.length > MAX_NAME) return 'tooLong';
  return null;
}

export function validateLogin(value: string): ErrorCode | null {
  const v = normalizeLogin(value);
  if (v === '') return 'required';
  return LOGIN_PATTERN.test(v) ? null : 'loginFormat';
}

export function validateEmail(value: string): ErrorCode | null {
  const v = value.trim();
  if (v === '') return 'required';
  return EMAIL_PATTERN.test(v) ? null : 'email';
}

export function validatePassword(value: string): ErrorCode | null {
  if (value === '') return 'required';
  return value.length < MIN_PASSWORD ? 'passwordShort' : null;
}

export function validateSignUp(v: SignUpValues): Partial<Record<Field, ErrorCode>> {
  const errors: Partial<Record<Field, ErrorCode>> = {};
  const checks: Array<[Field, ErrorCode | null]> = [
    ['firstName', validateName(v.firstName)],
    ['lastName', validateName(v.lastName)],
    ['login', validateLogin(v.login)],
    ['email', validateEmail(v.email)],
    ['password', validatePassword(v.password)],
  ];
  for (const [field, code] of checks) if (code) errors[field] = code;
  return errors;
}

// An existing account's password is whatever it was when it was made, so only "not empty" is checked.
export function validateSignIn(v: { email: string; password: string }): Partial<Record<'email' | 'password', ErrorCode>> {
  const errors: Partial<Record<'email' | 'password', ErrorCode>> = {};
  const email = validateEmail(v.email);
  if (email) errors.email = email;
  if (v.password === '') errors.password = 'required';
  return errors;
}

// What Supabase says, as a field and a code the screen can translate.
export function mapAuthError(err: unknown): { field: Field | null; code: ErrorCode } {
  const message = err instanceof Error || (typeof err === 'object' && err !== null && 'message' in err)
    ? String((err as { message: unknown }).message)
    : '';
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';

  if (/invalid login credentials/i.test(message)) return { field: null, code: 'badCredentials' };
  if (code === 'user_already_exists' || /already (been )?registered/i.test(message)) return { field: 'email', code: 'emailTaken' };
  // A taken login makes the sign-up trigger fail, which Supabase reports only in general terms.
  if (/database error saving new user/i.test(message)) return { field: 'login', code: 'loginTaken' };
  if (code === 'weak_password' || /password should be|weak password/i.test(message)) return { field: 'password', code: 'passwordWeak' };
  if (/network|fetch|timeout|timed out/i.test(message)) return { field: null, code: 'network' };
  return { field: null, code: 'unknown' };
}
