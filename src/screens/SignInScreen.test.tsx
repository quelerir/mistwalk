import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import SignInScreen from './SignInScreen';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// What sign-up returns while email confirmation is off: a session at once.
const WITH_SESSION = { data: { user: { id: 'u1' }, session: { access_token: 't' } }, error: null };

function makeClient(overrides: { signUp?: jest.Mock; signIn?: jest.Mock; rpc?: jest.Mock; resend?: jest.Mock; signInWithOtp?: jest.Mock } = {}) {
  return {
    rpc: overrides.rpc ?? jest.fn().mockResolvedValue({ data: true, error: null }),
    auth: {
      signUp: overrides.signUp ?? jest.fn().mockResolvedValue(WITH_SESSION),
      resend: overrides.resend ?? jest.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ data: { session: { access_token: 't' } }, error: null }),
      signInWithOtp: overrides.signInWithOtp ?? jest.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: overrides.signIn ?? jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
  } as unknown as SupabaseClient;
}

describe('SignInScreen', () => {
  it('starts on sign-in with only an email and a password', () => {
    const { getByTestId, queryByTestId } = render(<SignInScreen client={makeClient()} onSignedIn={jest.fn()} />);
    expect(getByTestId('signin-email')).toBeTruthy();
    expect(getByTestId('signin-password')).toBeTruthy();
    expect(queryByTestId('signin-firstName')).toBeNull();
    expect(queryByTestId('signin-login')).toBeNull();
  });

  it('signs in with the email and password', async () => {
    const signIn = jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const onSignedIn = jest.fn();
    const { getByTestId } = render(<SignInScreen client={makeClient({ signIn })} onSignedIn={onSignedIn} />);
    fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
    fireEvent.changeText(getByTestId('signin-password'), 'secret1');
    fireEvent.press(getByTestId('signin-submit'));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(signIn).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret1' });
  });

  it('shows a message for wrong credentials', async () => {
    const signIn = jest.fn().mockResolvedValue({ data: null, error: new Error('Invalid login credentials') });
    const { getByTestId, findByText } = render(<SignInScreen client={makeClient({ signIn })} onSignedIn={jest.fn()} />);
    fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
    fireEvent.changeText(getByTestId('signin-password'), 'wrong1');
    fireEvent.press(getByTestId('signin-submit'));
    expect(await findByText(/Wrong email or password|Неверный email или пароль/)).toBeTruthy();
  });

  it('switches to sign-up and sends the name, the login and the credentials', async () => {
    const signUp = jest.fn().mockResolvedValue(WITH_SESSION);
    const onSignedIn = jest.fn();
    const { getByTestId } = render(<SignInScreen client={makeClient({ signUp })} onSignedIn={onSignedIn} />);
    fireEvent.press(getByTestId('signin-tab-up'));
    fireEvent.changeText(getByTestId('signin-firstName'), 'Anna');
    fireEvent.changeText(getByTestId('signin-lastName'), 'K');
    fireEvent.changeText(getByTestId('signin-login'), '@anna_k');
    fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
    fireEvent.changeText(getByTestId('signin-password'), 'secret1');
    // the submit button waits for the live login check to say "free"
    await waitFor(() => expect(getByTestId('signin-submit').props.accessibilityState?.disabled).toBeFalsy(), { timeout: 2000 });
    fireEvent.press(getByTestId('signin-submit'));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(signUp).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret1',
      options: { data: { first_name: 'Anna', last_name: 'K', login: 'anna_k' } },
    });
  });

  it('does not let a taken login through', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: false, error: null });
    const signUp = jest.fn();
    const { getByTestId, findByText } = render(<SignInScreen client={makeClient({ rpc, signUp })} onSignedIn={jest.fn()} />);
    fireEvent.press(getByTestId('signin-tab-up'));
    fireEvent.changeText(getByTestId('signin-firstName'), 'Anna');
    fireEvent.changeText(getByTestId('signin-lastName'), 'K');
    fireEvent.changeText(getByTestId('signin-login'), 'anna_k');
    fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
    fireEvent.changeText(getByTestId('signin-password'), 'secret1');
    expect(await findByText(/This login is taken|Этот логин занят/, {}, { timeout: 2000 })).toBeTruthy();
    fireEvent.press(getByTestId('signin-submit'));
    expect(signUp).not.toHaveBeenCalled();
  });

  it('still signs up when the login check fails (an old server)', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: new Error('no such function') });
    const signUp = jest.fn().mockResolvedValue(WITH_SESSION);
    const onSignedIn = jest.fn();
    const { getByTestId } = render(<SignInScreen client={makeClient({ rpc, signUp })} onSignedIn={onSignedIn} />);
    fireEvent.press(getByTestId('signin-tab-up'));
    fireEvent.changeText(getByTestId('signin-firstName'), 'Anna');
    fireEvent.changeText(getByTestId('signin-lastName'), 'K');
    fireEvent.changeText(getByTestId('signin-login'), '@anna_k');
    fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
    fireEvent.changeText(getByTestId('signin-password'), 'secret1');
    await waitFor(() => expect(getByTestId('signin-submit').props.accessibilityState?.disabled).toBeFalsy(), { timeout: 2000 });
    fireEvent.press(getByTestId('signin-submit'));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(signUp).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret1',
      options: { data: { first_name: 'Anna', last_name: 'K', login: 'anna_k' } },
    });
  });

  it('explains a badly formed login', () => {
    const { getByTestId, getByText } = render(<SignInScreen client={makeClient()} onSignedIn={jest.fn()} />);
    fireEvent.press(getByTestId('signin-tab-up'));
    fireEvent.changeText(getByTestId('signin-login'), 'Анна');
    expect(getByText(/3 to 20|От 3 до 20/)).toBeTruthy();
  });

  it('shows the errors when the keyboard submits an invalid form', () => {
    const { getByTestId, queryByText, getAllByText } = render(<SignInScreen client={makeClient()} onSignedIn={jest.fn()} />);
    expect(queryByText(/Fill in this field|Заполните поле/)).toBeNull();
    fireEvent(getByTestId('signin-password'), 'submitEditing');
    expect(getAllByText(/Fill in this field|Заполните поле/).length).toBeGreaterThan(0);
  });

  describe('sign-in by a code from the email', () => {
    function openCodeMode(client = makeClient()) {
      const utils = render(<SignInScreen client={client} onSignedIn={jest.fn()} />);
      fireEvent.press(utils.getByTestId('signin-code-link'));
      return { ...utils, client };
    }

    it('shows a link to code mode on the sign-in tab and not on the sign-up tab', () => {
      const { getByTestId, queryByTestId } = render(<SignInScreen client={makeClient()} onSignedIn={jest.fn()} />);
      expect(getByTestId('signin-code-link')).toBeTruthy();
      fireEvent.press(getByTestId('signin-tab-up'));
      expect(queryByTestId('signin-code-link')).toBeNull();
    });

    it('code mode shows only the email field and the send button', () => {
      const { getByTestId, queryByTestId } = openCodeMode();
      expect(getByTestId('signin-email')).toBeTruthy();
      expect(getByTestId('signin-code-send')).toBeTruthy();
      expect(queryByTestId('signin-password')).toBeNull();
      expect(queryByTestId('signin-submit')).toBeNull();
    });

    it('an empty or malformed email is not sent and shows the email error', () => {
      const { getByTestId, getByText, client } = openCodeMode();
      fireEvent.press(getByTestId('signin-code-send'));
      expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
      fireEvent.changeText(getByTestId('signin-email'), 'not-an-email');
      fireEvent.press(getByTestId('signin-code-send'));
      expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
      expect(getByText(/Enter the full email|Введите email полностью/)).toBeTruthy();
    });

    it('a valid email sends the code and opens the code screen for that address', async () => {
      const { getByTestId, client } = openCodeMode();
      fireEvent.changeText(getByTestId('signin-email'), ' a@b.co ');
      fireEvent.press(getByTestId('signin-code-send'));
      await waitFor(() => expect(getByTestId('verify-code')).toBeTruthy());
      expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.co', options: { shouldCreateUser: true } });
    });

    it('a second tap while the request is pending sends only one', async () => {
      let resolve!: (v: unknown) => void;
      const signInWithOtp = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
      const { getByTestId } = openCodeMode(makeClient({ signInWithOtp }));
      fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
      fireEvent.press(getByTestId('signin-code-send'));
      fireEvent.press(getByTestId('signin-code-send'));
      expect(signInWithOtp).toHaveBeenCalledTimes(1);
      await act(async () => resolve({ data: {}, error: null }));
    });

    it('a failed send shows the mapped error and stays in code mode', async () => {
      const signInWithOtp = jest.fn().mockResolvedValue({ data: null, error: { message: 'x', code: 'over_email_send_rate_limit' } });
      const { getByTestId, findByText } = openCodeMode(makeClient({ signInWithOtp }));
      fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
      fireEvent.press(getByTestId('signin-code-send'));
      expect(await findByText(/Too many attempts|Слишком много попыток/)).toBeTruthy();
      expect(getByTestId('signin-code-send')).toBeTruthy();
    });

    it('the back link returns to the password form with the typed email kept', () => {
      const { getByTestId } = openCodeMode();
      fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
      fireEvent.press(getByTestId('signin-code-back'));
      expect(getByTestId('signin-password')).toBeTruthy();
      expect(getByTestId('signin-email').props.value).toBe('a@b.co');
    });
  });

  describe('email confirmation', () => {
    // What sign-up returns while confirmation is on: a user and no session.
    const NO_SESSION = { data: { user: { id: 'u1' }, session: null }, error: null };

    async function signUpForm(utils: ReturnType<typeof render>) {
      const { getByTestId } = utils;
      fireEvent.press(getByTestId('signin-tab-up'));
      fireEvent.changeText(getByTestId('signin-firstName'), 'Anna');
      fireEvent.changeText(getByTestId('signin-lastName'), 'K');
      fireEvent.changeText(getByTestId('signin-login'), '@anna_k');
      fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
      fireEvent.changeText(getByTestId('signin-password'), 'secret1');
      await waitFor(() => expect(getByTestId('signin-submit').props.accessibilityState?.disabled).toBeFalsy(), { timeout: 2000 });
      fireEvent.press(getByTestId('signin-submit'));
    }

    it('opens the verify screen for that email when sign-up returns no session', async () => {
      const onSignedIn = jest.fn();
      const utils = render(<SignInScreen client={makeClient({ signUp: jest.fn().mockResolvedValue(NO_SESSION) })} onSignedIn={onSignedIn} />);
      await signUpForm(utils);
      expect(await utils.findByTestId('verify-code')).toBeTruthy();
      expect(utils.getByText(/a@b\.co/)).toBeTruthy();
      expect(onSignedIn).not.toHaveBeenCalled();
    });

    it('opens the verify screen and sends a new code when sign-in says the email is not confirmed', async () => {
      const signIn = jest.fn().mockResolvedValue({ data: null, error: { message: 'Email not confirmed', code: 'email_not_confirmed' } });
      const resend = jest.fn().mockResolvedValue({ data: {}, error: null });
      const { getByTestId, findByTestId } = render(<SignInScreen client={makeClient({ signIn, resend })} onSignedIn={jest.fn()} />);
      fireEvent.changeText(getByTestId('signin-email'), 'a@b.co');
      fireEvent.changeText(getByTestId('signin-password'), 'secret1');
      fireEvent.press(getByTestId('signin-submit'));
      expect(await findByTestId('verify-code')).toBeTruthy();
      expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.co' });
    });

    it('"use another email" returns to the form with the typed values kept', async () => {
      const utils = render(<SignInScreen client={makeClient({ signUp: jest.fn().mockResolvedValue(NO_SESSION) })} onSignedIn={jest.fn()} />);
      await signUpForm(utils);
      fireEvent.press(await utils.findByTestId('verify-back'));
      expect(utils.getByTestId('signin-email').props.value).toBe('a@b.co');
      expect(utils.getByTestId('signin-login').props.value).toBe('@anna_k');
    });

    it('a correct code on the verify screen signs in', async () => {
      const onSignedIn = jest.fn();
      const utils = render(<SignInScreen client={makeClient({ signUp: jest.fn().mockResolvedValue(NO_SESSION) })} onSignedIn={onSignedIn} />);
      await signUpForm(utils);
      fireEvent.changeText(await utils.findByTestId('verify-code'), '123456');
      fireEvent.press(utils.getByTestId('verify-submit'));
      await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    });
  });
});
