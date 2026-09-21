import {
  mapAuthError,
  normalizeLogin,
  validateEmail,
  validateLogin,
  validateName,
  validatePassword,
  validateSignIn,
  validateSignUp,
} from './validation';

describe('normalizeLogin', () => {
  it('trims and drops a leading @', () => {
    expect(normalizeLogin('  @anna_k ')).toBe('anna_k');
    expect(normalizeLogin('anna_k')).toBe('anna_k');
  });
});

describe('validateLogin', () => {
  it.each([
    ['', 'required'],
    ['ab', 'loginFormat'],
    ['a'.repeat(21), 'loginFormat'],
    ['anna.k', 'loginFormat'],
    ['anna k', 'loginFormat'],
    ['Анна', 'loginFormat'],
    ['anna_k', null],
    ['ANNA123', null],
    ['a_b', null],
  ])('%p gives %p', (value, expected) => {
    expect(validateLogin(value)).toBe(expected);
  });
});

describe('validateName', () => {
  it('requires a value and caps the length', () => {
    expect(validateName('   ')).toBe('required');
    expect(validateName('x'.repeat(41))).toBe('tooLong');
    expect(validateName('Анна')).toBeNull();
    expect(validateName('  Anna  ')).toBeNull();
  });
});

describe('validateEmail', () => {
  it.each([
    ['', 'required'],
    ['anna', 'email'],
    ['anna@', 'email'],
    ['anna@host', 'email'],
    ['a b@host.com', 'email'],
    ['anna@host.com', null],
  ])('%p gives %p', (value, expected) => {
    expect(validateEmail(value)).toBe(expected);
  });
});

describe('validatePassword', () => {
  it('needs at least 6 characters', () => {
    expect(validatePassword('')).toBe('required');
    expect(validatePassword('12345')).toBe('passwordShort');
    expect(validatePassword('123456')).toBeNull();
  });
});

describe('validateSignUp', () => {
  const good = { firstName: 'Anna', lastName: 'K', login: 'anna_k', email: 'a@b.co', password: 'secret1' };

  it('returns no errors for good values', () => {
    expect(validateSignUp(good)).toEqual({});
  });

  it('returns an error per bad field', () => {
    expect(validateSignUp({ ...good, firstName: '', login: 'a', password: '1' })).toEqual({
      firstName: 'required',
      login: 'loginFormat',
      password: 'passwordShort',
    });
  });

  it('accepts a login typed with a leading @', () => {
    expect(validateSignUp({ ...good, login: '@anna_k' })).toEqual({});
  });
});

describe('validateSignIn', () => {
  it('checks only the email and the password (no length rule on an existing password)', () => {
    expect(validateSignIn({ email: '', password: '' })).toEqual({ email: 'required', password: 'required' });
    expect(validateSignIn({ email: 'a@b.co', password: '1' })).toEqual({});
  });
});

describe('mapAuthError', () => {
  it.each([
    [{ message: 'Invalid login credentials' }, null, 'badCredentials'],
    [{ message: 'User already registered' }, 'email', 'emailTaken'],
    [{ message: 'x', code: 'user_already_exists' }, 'email', 'emailTaken'],
    [{ message: 'Database error saving new user' }, 'login', 'loginTaken'],
    [{ message: 'Password should be at least 6 characters.' }, 'password', 'passwordWeak'],
    [{ message: 'x', code: 'weak_password' }, 'password', 'passwordWeak'],
    [{ message: 'Network request failed' }, null, 'network'],
    [new Error('something else'), null, 'unknown'],
    ['not an error', null, 'unknown'],
  ])('%p maps to field %p and code %p', (err, field, code) => {
    expect(mapAuthError(err)).toEqual({ field, code });
  });
});
