import { Geolocation as CapacitorGeolocation, Position, PositionOptions } from '@capacitor/geolocation';
import { isNativePlatform, isPluginAvailable } from './platform';

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface GeolocationPosition {
  coords: GeolocationCoordinates;
  timestamp: number;
}

export class GeolocationService {
  private static async checkPermissions(): Promise<boolean> {
    if (!isNativePlatform() || !isPluginAvailable('Geolocation')) {
      return true;
    }

    try {
      const permission = await CapacitorGeolocation.checkPermissions();
      
      if (permission.location === 'granted' || permission.coarseLocation === 'granted') {
        return true;
      }

      if (permission.location === 'prompt' || permission.location === 'prompt-with-rationale') {
        const requestResult = await CapacitorGeolocation.requestPermissions();
        return requestResult.location === 'granted' || requestResult.coarseLocation === 'granted';
      }

      return false;
    } catch (error) {
      console.error('Error checking geolocation permissions:', error);
      return false;
    }
  }

  static async getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
    if (isNativePlatform() && isPluginAvailable('Geolocation')) {
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        throw new Error('Geolocation permission denied');
      }

      try {
        const position: Position = await CapacitorGeolocation.getCurrentPosition({
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 0,
        });

        return {
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
        };
      } catch (error) {
        console.error('Capacitor Geolocation error:', error);
        throw new Error('Failed to get current position');
      }
    } else {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            });
          },
          (error) => {
            console.error('Web Geolocation error:', error);
            reject(new Error(`Geolocation error: ${error.message}`));
          },
          {
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            timeout: options?.timeout ?? 10000,
            maximumAge: options?.maximumAge ?? 0,
          }
        );
      });
    }
  }

  static async watchPosition(
    callback: (position: GeolocationPosition) => void,
    errorCallback?: (error: Error) => void,
    options?: PositionOptions
  ): Promise<string> {
    if (isNativePlatform() && isPluginAvailable('Geolocation')) {
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        throw new Error('Geolocation permission denied');
      }

      const watchId = await CapacitorGeolocation.watchPosition(
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 0,
        },
        (position, error) => {
          if (error) {
            errorCallback?.(new Error(error.message));
            return;
          }

          if (position) {
            callback({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            });
          }
        }
      );

      return watchId;
    } else {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          callback({
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
            },
            timestamp: position.timestamp,
          });
        },
        (error) => {
          errorCallback?.(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 0,
        }
      );

      return watchId.toString();
    }
  }

  static async clearWatch(watchId: string): Promise<void> {
    if (isNativePlatform() && isPluginAvailable('Geolocation')) {
      await CapacitorGeolocation.clearWatch({ id: watchId });
    } else {
      navigator.geolocation.clearWatch(parseInt(watchId, 10));
    }
  }
}
