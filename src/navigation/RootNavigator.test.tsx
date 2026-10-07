import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import RootNavigator from './RootNavigator';
import { useLoginChosen } from '../hooks/useLoginChosen';
import { signOut } from '../lib/supabase/auth';

jest.mock('../hooks/useLoginChosen', () => ({ useLoginChosen: jest.fn() }));
jest.mock('../lib/supabase/auth', () => ({ signOut: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../screens/SignInScreen', () => () => require('react').createElement(require('react-native').Text, null, 'SIGNIN'));

let chooseProps: { onDone: () => void; onSignOut: () => void } | null = null;
jest.mock('../screens/ChooseLoginScreen', () => (props: { onDone: () => void; onSignOut: () => void }) => {
  chooseProps = props;
  return require('react').createElement(require('react-native').Text, null, 'CHOOSE');
});

const client = {} as SupabaseClient;
const session = { user: { id: 'u1' } } as Session;
const mockStatus = useLoginChosen as jest.Mock;

function renderNav(s: Session | null = session, onSignedOut = jest.fn()) {
  const utils = render(
    <RootNavigator client={client} session={s} onSignedIn={jest.fn()} onSignedOut={onSignedOut}>
      <Text>APP</Text>
    </RootNavigator>,
  );
  return { ...utils, onSignedOut };
}

beforeEach(() => {
  chooseProps = null;
  mockStatus.mockReset();
});

describe('RootNavigator', () => {
  it('shows the sign-in screen without a session', () => {
    mockStatus.mockReturnValue('loading');
    const { getByText, queryByText } = renderNav(null);
    expect(getByText('SIGNIN')).toBeTruthy();
    expect(queryByText('APP')).toBeNull();
  });

  it('shows nothing while the login state loads', () => {
    mockStatus.mockReturnValue('loading');
    const { queryByText } = renderNav();
    expect(queryByText('APP')).toBeNull();
    expect(queryByText('CHOOSE')).toBeNull();
    expect(queryByText('SIGNIN')).toBeNull();
  });

  it('shows the choose-login screen when a login is needed', () => {
    mockStatus.mockReturnValue('needed');
    const { getByText, queryByText } = renderNav();
    expect(getByText('CHOOSE')).toBeTruthy();
    expect(queryByText('APP')).toBeNull();
  });

  it.each(['chosen', 'error'])('shows the app when the state is %s', (state) => {
    mockStatus.mockReturnValue(state);
    const { getByText } = renderNav();
    expect(getByText('APP')).toBeTruthy();
  });

  it('shows the app after the login is chosen, without a new query', () => {
    mockStatus.mockReturnValue('needed');
    const { getByText, queryByText } = renderNav();
    act(() => chooseProps!.onDone());
    expect(getByText('APP')).toBeTruthy();
    expect(queryByText('CHOOSE')).toBeNull();
  });

  it('sign out on the choose-login screen signs out and tells the app', async () => {
    mockStatus.mockReturnValue('needed');
    const { onSignedOut } = renderNav();
    await act(async () => chooseProps!.onSignOut());
    expect(signOut).toHaveBeenCalledWith(client);
    expect(onSignedOut).toHaveBeenCalled();
  });
});
