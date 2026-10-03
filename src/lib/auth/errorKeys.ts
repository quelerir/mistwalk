import type { ErrorCode } from './validation';
import type { Key } from '../../i18n/ru';

export const ERROR_KEYS: Record<ErrorCode, Key> = {
  required: 'signin.err.required',
  tooLong: 'signin.err.tooLong',
  loginFormat: 'signin.err.loginFormat',
  email: 'signin.err.email',
  passwordShort: 'signin.err.passwordShort',
  passwordWeak: 'signin.err.passwordWeak',
  emailTaken: 'signin.err.emailTaken',
  loginTaken: 'signin.err.loginTaken',
  badCredentials: 'signin.err.badCredentials',
  network: 'signin.err.network',
  codeInvalid: 'signin.err.codeInvalid',
  tooManyRequests: 'signin.err.tooManyRequests',
  emailNotConfirmed: 'signin.err.emailNotConfirmed',
  unknown: 'signin.failed',
};
