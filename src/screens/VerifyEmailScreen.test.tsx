import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import VerifyEmailScreen from './VerifyEmailScreen';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

function makeClient(overrides: { verifyOtp?: jest.Mock; resend?: jest.Mock; signInWithOtp?: jest.Mock } = {}) {
  return {
    auth: {
      verifyOtp: overrides.verifyOtp ?? jest.fn().mockResolvedValue({ data: { session: { access_token: 't' } }, error: null }),
      resend: overrides.resend ?? jest.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithOtp: overrides.signInWithOtp ?? jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
  } as unknown as SupabaseClient;
}

function setup(props: { client?: SupabaseClient; initialCooldown?: number; purpose?: 'signup' | 'login' } = {}) {
  const onVerified = jest.fn();
  const onBack = jest.fn();
  const client = props.client ?? makeClient();
  const utils = render(
    <VerifyEmailScreen client={client} email="a@b.co" onVerified={onVerified} onBack={onBack} initialCooldown={props.initialCooldown} purpose={props.purpose} />,
  );
  return { ...utils, client, onVerified, onBack };
}

const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => !!el.props.accessibilityState?.disabled;

describe('VerifyEmailScreen', () => {
  it('shows the address the code was sent to', () => {
    const { getByText } = setup();
    expect(getByText(/a@b\.co/)).toBeTruthy();
  });

  it('keeps submit disabled until the code has 6 digits', () => {
    const { getByTestId } = setup();
    expect(disabled(getByTestId('verify-submit'))).toBe(true);
    fireEvent.changeText(getByTestId('verify-code'), '12345');
    expect(disabled(getByTestId('verify-submit'))).toBe(true);
    fireEvent.changeText(getByTestId('verify-code'), '123456');
    expect(disabled(getByTestId('verify-submit'))).toBe(false);
  });

  it('strips spaces and letters from what is typed', () => {
    const { getByTestId } = setup();
    fireEvent.changeText(getByTestId('verify-code'), '123 4a56');
    expect(getByTestId('verify-code').props.value).toBe('123456');
  });

  it('a correct code calls verifyOtp with the email, the token and type "email", then onVerified', async () => {
    const { getByTestId, client, onVerified } = setup();
    fireEvent.changeText(getByTestId('verify-code'), '123456');
    fireEvent.press(getByTestId('verify-submit'));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email' });
  });

  it('a wrong or expired code shows the message and does not call onVerified', async () => {
    const verifyOtp = jest.fn().mockResolvedValue({ data: null, error: { message: 'Token has expired or is invalid', code: 'otp_expired' } });
    const { getByTestId, findByText, onVerified } = setup({ client: makeClient({ verifyOtp }) });
    fireEvent.changeText(getByTestId('verify-code'), '000000');
    fireEvent.press(getByTestId('verify-submit'));
    expect(await findByText(/Wrong or expired code|Неверный код/)).toBeTruthy();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('a second press while the request is pending does not call verifyOtp twice', async () => {
    let resolve!: (v: unknown) => void;
    const verifyOtp = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { getByTestId, onVerified } = setup({ client: makeClient({ verifyOtp }) });
    fireEvent.changeText(getByTestId('verify-code'), '123456');
    fireEvent.press(getByTestId('verify-submit'));
    fireEvent.press(getByTestId('verify-submit'));
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ data: { session: {} }, error: null }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  });

  it('a network error shows the network message and the button works again', async () => {
    const verifyOtp = jest.fn().mockResolvedValue({ data: null, error: new Error('Network request failed') });
    const { getByTestId, findByText } = setup({ client: makeClient({ verifyOtp }) });
    fireEvent.changeText(getByTestId('verify-code'), '123456');
    fireEvent.press(getByTestId('verify-submit'));
    expect(await findByText(/No connection|Нет связи/)).toBeTruthy();
    await waitFor(() => expect(disabled(getByTestId('verify-submit'))).toBe(false));
  });

  it('with purpose "login" a wrong code shows the codeInvalid message and the buttons work again', async () => {
    const verifyOtp = jest.fn().mockResolvedValue({ data: null, error: { message: 'Token has expired or is invalid', code: 'otp_expired' } });
    const { getByTestId, findByText, onVerified } = setup({ client: makeClient({ verifyOtp }), purpose: 'login' });
    fireEvent.changeText(getByTestId('verify-code'), '000000');
    fireEvent.press(getByTestId('verify-submit'));
    expect(await findByText(/Wrong or expired code|Неверный код/)).toBeTruthy();
    expect(onVerified).not.toHaveBeenCalled();
    await waitFor(() => expect(disabled(getByTestId('verify-submit'))).toBe(false));
  });

  it('"use another email" calls onBack', () => {
    const { getByTestId, onBack } = setup();
    fireEvent.press(getByTestId('verify-back'));
    expect(onBack).toHaveBeenCalled();
  });

  describe('resend', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('is disabled during the countdown, shows the seconds left, calls resend after it ends, then restarts the countdown', async () => {
      const { getByTestId, getByText, client } = setup({ initialCooldown: 2 });
      expect(disabled(getByTestId('verify-resend'))).toBe(true);
      expect(getByText(/\b2\b/)).toBeTruthy();
      act(() => { jest.advanceTimersByTime(1000); });
      expect(getByText(/\b1\b/)).toBeTruthy();
      act(() => { jest.advanceTimersByTime(1000); });
      expect(disabled(getByTestId('verify-resend'))).toBe(false);

      await act(async () => { fireEvent.press(getByTestId('verify-resend')); });
      expect(client.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.co' });
      expect(disabled(getByTestId('verify-resend'))).toBe(true);
    });

    it('with purpose "login" send again calls signInWithOtp and not resend', async () => {
      const { getByTestId, client } = setup({ initialCooldown: 0, purpose: 'login' });
      await act(async () => { fireEvent.press(getByTestId('verify-resend')); });
      expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.co', options: { shouldCreateUser: true } });
      expect(client.auth.resend).not.toHaveBeenCalled();
    });

    it('with the default purpose send again calls resend and not signInWithOtp', async () => {
      const { getByTestId, client } = setup({ initialCooldown: 0 });
      await act(async () => { fireEvent.press(getByTestId('verify-resend')); });
      expect(client.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.co' });
      expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
    });

    it('a second tap on send again while the first request is pending sends only one', async () => {
      let resolve!: (v: unknown) => void;
      const signInWithOtp = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
      const { getByTestId } = setup({ client: makeClient({ signInWithOtp }), initialCooldown: 0, purpose: 'login' });
      fireEvent.press(getByTestId('verify-resend'));
      fireEvent.press(getByTestId('verify-resend'));
      expect(signInWithOtp).toHaveBeenCalledTimes(1);
      await act(async () => resolve({ data: {}, error: null }));
    });

    it('a rate-limit error from resend shows the tooManyRequests message', async () => {
      const resend = jest.fn().mockResolvedValue({ data: null, error: { message: 'x', code: 'over_email_send_rate_limit' } });
      const { getByTestId, findByText } = setup({ client: makeClient({ resend }), initialCooldown: 0 });
      await act(async () => { fireEvent.press(getByTestId('verify-resend')); });
      expect(await findByText(/Too many attempts|Слишком много попыток/)).toBeTruthy();
    });
  });
});
