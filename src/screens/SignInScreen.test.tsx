import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import SignInScreen from './SignInScreen';

function makeClient(overrides: { signUp?: jest.Mock; signIn?: jest.Mock; rpc?: jest.Mock } = {}) {
  return {
    rpc: overrides.rpc ?? jest.fn().mockResolvedValue({ data: true, error: null }),
    auth: {
      signUp: overrides.signUp ?? jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
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
    const signUp = jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
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
});
