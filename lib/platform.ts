import { Capacitor } from '@capacitor/core';

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const isAndroid = (): boolean => {
  return Capacitor.getPlatform() === 'android';
};

export const isIOS = (): boolean => {
  return Capacitor.getPlatform() === 'ios';
};

export const isWeb = (): boolean => {
  return Capacitor.getPlatform() === 'web';
};

export const getPlatform = (): string => {
  return Capacitor.getPlatform();
};

export const isPluginAvailable = (pluginName: string): boolean => {
  return Capacitor.isPluginAvailable(pluginName);
};

export const convertFileSrc = (filePath: string): string => {
  return Capacitor.convertFileSrc(filePath);
};
