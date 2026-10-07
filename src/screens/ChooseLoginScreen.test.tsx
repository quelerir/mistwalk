import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import ChooseLoginScreen from './ChooseLoginScreen';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

function makeClient(setLoginResult: { data: unknown; error: unknown } = { data: null, error: null }, free = true) {
  const rpc = jest.fn((name: string) =>
    Promise.resolve(name === 'login_available' ? { data: free, error: null } : setLoginResult),
  );
  return { rpc } as unknown as SupabaseClient;
}

function setup(client = makeClient()) {
  const onDone = jest.fn();
  const onSignOut = jest.fn();
  const utils = render(<ChooseLoginScreen client={client} onDone={onDone} onSignOut={onSignOut} />);
  return { ...utils, client, onDone, onSignOut };
}

const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => !!el.props.accessibilityState?.disabled;

describe('ChooseLoginScreen', () => {
  it('keeps submit disabled until the login is free', async () => {
    const { getByTestId } = setup();
    expect(disabled(getByTestId('choose-submit'))).toBe(true);
    fireEvent.changeText(getByTestId('choose-login'), '@anna_k');
    await waitFor(() => expect(disabled(getByTestId('choose-submit'))).toBe(false), { timeout: 2000 });
  });

  it('submit calls set_login with the normalized login and then onDone', async () => {
    const { getByTestId, client, onDone } = setup();
    fireEvent.changeText(getByTestId('choose-login'), '@anna_k');
    await waitFor(() => expect(disabled(getByTestId('choose-submit'))).toBe(false), { timeout: 2000 });
    fireEvent.press(getByTestId('choose-submit'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(client.rpc).toHaveBeenCalledWith('set_login', { candidate: 'anna_k' });
  });

  it('a login_taken failure shows the taken message and stays', async () => {
    const { getByTestId, findAllByText, onDone } = setup(makeClient({ data: null, error: { message: 'login_taken' } }));
    fireEvent.changeText(getByTestId('choose-login'), 'anna_k');
    await waitFor(() => expect(disabled(getByTestId('choose-submit'))).toBe(false), { timeout: 2000 });
    fireEvent.press(getByTestId('choose-submit'));
    expect((await findAllByText(/This login is taken|Этот логин занят/)).length).toBeGreaterThan(0);
    expect(onDone).not.toHaveBeenCalled();
    await waitFor(() => expect(disabled(getByTestId('choose-submit'))).toBe(false));
  });

  it('sign out calls onSignOut', () => {
    const { getByTestId, onSignOut } = setup();
    fireEvent.press(getByTestId('choose-signout'));
    expect(onSignOut).toHaveBeenCalled();
  });
});
