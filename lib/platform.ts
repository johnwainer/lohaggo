export const isNativePlatform = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
};

export const isWeb = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.getPlatform() === 'web';
  } catch {
    return true;
  }
};

export const getPlatform = (): string => {
  if (typeof window === 'undefined') return 'web';
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
};

export const isPluginAvailable = (pluginName: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isPluginAvailable(pluginName);
  } catch {
    return false;
  }
};

export const convertFileSrc = (filePath: string): string => {
  if (typeof window === 'undefined') return filePath;
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.convertFileSrc(filePath);
  } catch {
    return filePath;
  }
};