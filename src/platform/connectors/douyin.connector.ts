import type {
  AuthorizeResult,
  AuthStatusResult,
  ListenerState,
} from './base.connector';
import { BaseConnector } from './base.connector';

/**
 * Douyin connector stub. Not implemented in dev phase.
 */
export class DouyinConnector extends BaseConnector {
  readonly platform = 'douyin';

  async authorize(): Promise<AuthorizeResult> {
    return {
      authId: '',
      expiresIn: 0,
      status: 'failed',
    };
  }

  async getAuthStatus(): Promise<AuthStatusResult> {
    return { authId: '', status: 'failed' };
  }

  async startListener(): Promise<void> {
    // no-op stub
  }

  async stopListener(): Promise<void> {
    // no-op stub
  }

  async getListenerState(): Promise<ListenerState> {
    return {
      isListening: false,
      startedAt: null,
      messagesReceived: 0,
      messagesProcessed: 0,
      errors: 0,
    };
  }
}
