import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { isNativePlatform, isPluginAvailable, isAndroid, isIOS } from './platform';

export class MobileHelpers {
  static async initializeApp() {
    if (!isNativePlatform()) return;

    try {
      await this.setupStatusBar();
      await this.setupKeyboard();
      await this.hideSplashScreen();
      await this.setupBackButton();
      await this.setupNetworkListener();
    } catch (error) {
      console.error('Error initializing mobile app:', error);
    }
  }

  static async setupStatusBar() {
    if (!isPluginAvailable('StatusBar')) return;

    try {
      await StatusBar.setStyle({ style: Style.Light });
      
      if (isAndroid()) {
        await StatusBar.setBackgroundColor({ color: '#3b82f6' });
      }
    } catch (error) {
      console.error('Error setting up status bar:', error);
    }
  }

  static async setupKeyboard() {
    if (!isPluginAvailable('Keyboard')) return;

    try {
      await Keyboard.setAccessoryBarVisible({ isVisible: true });

      if (isAndroid()) {
        await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
      }
    } catch (error) {
      console.error('Error setting up keyboard:', error);
    }
  }

  static async hideSplashScreen() {
    if (!isPluginAvailable('SplashScreen')) return;

    try {
      await SplashScreen.hide();
    } catch (error) {
      console.error('Error hiding splash screen:', error);
    }
  }

  static async setupBackButton() {
    if (!isPluginAvailable('App')) return;

    try {
      App.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          App.exitApp();
        } else {
          window.history.back();
        }
      });
    } catch (error) {
      console.error('Error setting up back button:', error);
    }
  }

  static async setupNetworkListener() {
    if (!isPluginAvailable('Network')) return;

    try {
      Network.addListener('networkStatusChange', (status) => {
        console.log('Network status changed:', status);
        
        if (!status.connected) {
          console.warn('No internet connection');
        }
      });
    } catch (error) {
      console.error('Error setting up network listener:', error);
    }
  }

  static async getNetworkStatus() {
    if (!isPluginAvailable('Network')) {
      return { connected: true, connectionType: 'unknown' };
    }

    try {
      return await Network.getStatus();
    } catch (error) {
      console.error('Error getting network status:', error);
      return { connected: true, connectionType: 'unknown' };
    }
  }

  static async hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
    if (!isPluginAvailable('Haptics')) return;

    try {
      const impactStyle = 
        style === 'light' ? ImpactStyle.Light :
        style === 'heavy' ? ImpactStyle.Heavy :
        ImpactStyle.Medium;

      await Haptics.impact({ style: impactStyle });
    } catch (error) {
      console.error('Error triggering haptic feedback:', error);
    }
  }

  static async hapticVibrate() {
    if (!isPluginAvailable('Haptics')) return;

    try {
      await Haptics.vibrate();
    } catch (error) {
      console.error('Error triggering vibration:', error);
    }
  }

  static async share(options: { title?: string; text?: string; url?: string; dialogTitle?: string }) {
    if (!isPluginAvailable('Share')) {
      if (navigator.share) {
        try {
          await navigator.share({
            title: options.title,
            text: options.text,
            url: options.url,
          });
          return true;
        } catch (error) {
          console.error('Web Share API error:', error);
          return false;
        }
      }
      return false;
    }

    try {
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle || 'Share',
      });
      return true;
    } catch (error) {
      console.error('Error sharing:', error);
      return false;
    }
  }

  static async getAppInfo() {
    if (!isPluginAvailable('App')) {
      return {
        name: 'LoHaggo',
        id: 'com.lohaggo.app',
        version: '1.0.0',
        build: '1',
      };
    }

    try {
      return await App.getInfo();
    } catch (error) {
      console.error('Error getting app info:', error);
      return {
        name: 'LoHaggo',
        id: 'com.lohaggo.app',
        version: '1.0.0',
        build: '1',
      };
    }
  }

  static async exitApp() {
    if (!isPluginAvailable('App')) return;

    try {
      await App.exitApp();
    } catch (error) {
      console.error('Error exiting app:', error);
    }
  }

  static removeAllListeners() {
    if (!isNativePlatform()) return;

    try {
      if (isPluginAvailable('App')) {
        App.removeAllListeners();
      }
      if (isPluginAvailable('Network')) {
        Network.removeAllListeners();
      }
      if (isPluginAvailable('Keyboard')) {
        Keyboard.removeAllListeners();
      }
    } catch (error) {
      console.error('Error removing listeners:', error);
    }
  }
}
