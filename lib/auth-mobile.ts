import { apiClient } from './api-client';

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: string;
  partnerId?: string;
  clientRating?: number;
  clientTotalReviews?: number;
  isActive?: boolean;
}

export interface Session {
  user: User;
  expires: string;
}

const SESSION_KEY = 'lohaggo_session';
const TOKEN_KEY = 'lohaggo_token';

export const mobileAuth = {
  async signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await apiClient.post<{ user: User; token: string; expires: string }>(
        '/auth/mobile/signin',
        { email, password }
      );

      if (response.token) {
        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          user: response.user,
          expires: response.expires
        }));
        return { ok: true };
      }

      return { ok: false, error: 'Invalid response from server' };
    } catch (error: any) {
      console.error('[mobileAuth] Sign in error:', error);
      return { ok: false, error: error.message || 'Authentication failed' };
    }
  },

  async signOut(): Promise<void> {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        await apiClient.post('/auth/mobile/signout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('[mobileAuth] Sign out error:', error);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  },

  getSession(): Session | null {
    try {
      const sessionData = localStorage.getItem(SESSION_KEY);
      if (!sessionData) return null;

      const session = JSON.parse(sessionData);
      
      if (new Date(session.expires) < new Date()) {
        this.signOut();
        return null;
      }

      return session;
    } catch (error) {
      console.error('[mobileAuth] Get session error:', error);
      return null;
    }
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }
};
