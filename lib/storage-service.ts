import { Preferences } from '@capacitor/preferences';
import { isNativePlatform, isPluginAvailable } from './platform';

export class StorageService {
  static async get(key: string): Promise<string | null> {
    if (isNativePlatform() && isPluginAvailable('Preferences')) {
      try {
        const { value } = await Preferences.get({ key });
        return value;
      } catch (error) {
        console.error('Capacitor Preferences get error:', error);
        return null;
      }
    } else {
      if (typeof window === 'undefined') {
        return null;
      }
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('localStorage get error:', error);
        return null;
      }
    }
  }

  static async set(key: string, value: string): Promise<void> {
    if (isNativePlatform() && isPluginAvailable('Preferences')) {
      try {
        await Preferences.set({ key, value });
      } catch (error) {
        console.error('Capacitor Preferences set error:', error);
        throw error;
      }
    } else {
      if (typeof window === 'undefined') {
        return;
      }
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('localStorage set error:', error);
        throw error;
      }
    }
  }

  static async remove(key: string): Promise<void> {
    if (isNativePlatform() && isPluginAvailable('Preferences')) {
      try {
        await Preferences.remove({ key });
      } catch (error) {
        console.error('Capacitor Preferences remove error:', error);
        throw error;
      }
    } else {
      if (typeof window === 'undefined') {
        return;
      }
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('localStorage remove error:', error);
        throw error;
      }
    }
  }

  static async clear(): Promise<void> {
    if (isNativePlatform() && isPluginAvailable('Preferences')) {
      try {
        await Preferences.clear();
      } catch (error) {
        console.error('Capacitor Preferences clear error:', error);
        throw error;
      }
    } else {
      if (typeof window === 'undefined') {
        return;
      }
      try {
        localStorage.clear();
      } catch (error) {
        console.error('localStorage clear error:', error);
        throw error;
      }
    }
  }

  static async keys(): Promise<string[]> {
    if (isNativePlatform() && isPluginAvailable('Preferences')) {
      try {
        const { keys } = await Preferences.keys();
        return keys;
      } catch (error) {
        console.error('Capacitor Preferences keys error:', error);
        return [];
      }
    } else {
      if (typeof window === 'undefined') {
        return [];
      }
      try {
        return Object.keys(localStorage);
      } catch (error) {
        console.error('localStorage keys error:', error);
        return [];
      }
    }
  }

  static async getObject<T = any>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Error parsing stored object:', error);
      return null;
    }
  }

  static async setObject<T = any>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await this.set(key, jsonValue);
    } catch (error) {
      console.error('Error stringifying object:', error);
      throw error;
    }
  }
}
