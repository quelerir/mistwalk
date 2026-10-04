import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import ChatScreen from './ChatScreen';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { sendMessage } from '../lib/social/messages';

jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));
jest.mock('../components/icons/SvgIcon', () => () => null);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../hooks/useTypingIndicator');
jest.mock('../lib/social/messages', () => ({
  fetchMessagesWith: jest.fn().mockResolvedValue([]),
  markConversationRead: jest.fn().mockResolvedValue(undefined),
  sendMessage: jest.fn(),
  subscribeToIncomingMessages: jest.fn(() => ({})),
}));

const typing = { otherTyping: false, notifyTyping: jest.fn(), stopTyping: jest.fn(), clearTyping: jest.fn() };
const client = { removeChannel: jest.fn() } as unknown as SupabaseClient;

async function setup(over: Partial<typeof typing> = {}) {
  (useTypingIndicator as jest.Mock).mockReturnValue({ ...typing, ...over });
  const utils = render(<ChatScreen client={client} myId="me" otherId="other" otherName="Аня" onBack={jest.fn()} />);
  await act(async () => undefined); // let the history load finish
  return utils;
}

describe('ChatScreen typing indicator', () => {
  beforeEach(() => {
    Object.values(typing).forEach((f) => typeof f === 'function' && (f as jest.Mock).mockClear());
    (sendMessage as jest.Mock).mockReset().mockResolvedValue({
      id: 'm1', senderId: 'me', recipientId: 'other', body: 'hi', createdAt: 1, readAt: null,
    });
  });

  it('shows the indicator under the name only while the other user types', async () => {
    const { queryByText, rerender } = await setup({ otherTyping: false });
    expect(queryByText(/печатает|typing/)).toBeNull();
    (useTypingIndicator as jest.Mock).mockReturnValue({ ...typing, otherTyping: true });
    rerender(<ChatScreen client={client} myId="me" otherId="other" otherName="Аня" onBack={jest.fn()} />);
    expect(queryByText(/печатает|typing/)).toBeTruthy();
  });

  it('tells the other user when I type, and stops when the field is emptied', async () => {
    const { getByPlaceholderText } = await setup();
    const input = getByPlaceholderText(/Сообщение|Message/);
    fireEvent.changeText(input, 'при');
    expect(typing.notifyTyping).toHaveBeenCalledTimes(1);
    fireEvent.changeText(input, '  ');
    expect(typing.stopTyping).toHaveBeenCalledTimes(1);
  });

  it('stops typing when a message is sent', async () => {
    const { getByPlaceholderText, getByRole } = await setup();
    fireEvent.changeText(getByPlaceholderText(/Сообщение|Message/), 'hi');
    await act(async () => {
      fireEvent.press(getByRole('button', { name: /Отправить|Send/ }));
    });
    expect(typing.stopTyping).toHaveBeenCalled();
  });
});
