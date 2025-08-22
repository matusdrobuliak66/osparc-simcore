import { v4 as uuidv4 } from 'uuid';

const SESSION_STORAGE_KEY = 'osparc_client_session_id';

export class SessionManager {
  /**
   * Check if there's an active session
   */
  static hasActiveSession(): boolean {
    if (typeof window === 'undefined') return false;

    const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return sessionId !== null && sessionId.length > 0;
  }

  /**
   * Initialize a new session with a unique ID
   */
  static initializeSession(): string {
    if (typeof window === 'undefined') return '';

    const sessionId = uuidv4();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  }

  /**
   * Clear the current session
   */
  static clearSession(): void {
    if (typeof window === 'undefined') return;

    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  /**
   * Get the current client session ID
   */
  static getClientSessionId(): string | null {
    if (typeof window === 'undefined') return null;

    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  }

  /**
   * Get or create a session ID
   */
  static getOrCreateSessionId(): string {
    if (!this.hasActiveSession()) {
      return this.initializeSession();
    }
    return this.getClientSessionId() || this.initializeSession();
  }
}
