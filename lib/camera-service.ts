import { Camera, CameraResultType, CameraSource, Photo, GalleryPhoto } from '@capacitor/camera';
import { isNativePlatform, isPluginAvailable, convertFileSrc } from './platform';

export interface CameraOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: 'uri' | 'base64' | 'dataUrl';
  source?: 'camera' | 'photos' | 'prompt';
  width?: number;
  height?: number;
  correctOrientation?: boolean;
  saveToGallery?: boolean;
}

export interface CapturedPhoto {
  dataUrl?: string;
  base64String?: string;
  path?: string;
  webPath?: string;
  format: string;
}

export class CameraService {
  private static async checkPermissions(): Promise<boolean> {
    if (!isNativePlatform() || !isPluginAvailable('Camera')) {
      return true;
    }

    try {
      const permission = await Camera.checkPermissions();
      
      if (permission.camera === 'granted' && permission.photos === 'granted') {
        return true;
      }

      if (permission.camera !== 'granted' || permission.photos !== 'granted') {
        const requestResult = await Camera.requestPermissions();
        return requestResult.camera === 'granted' && requestResult.photos === 'granted';
      }

      return false;
    } catch (error) {
      console.error('Error checking camera permissions:', error);
      return false;
    }
  }

  private static getCameraSource(source?: 'camera' | 'photos' | 'prompt'): CameraSource {
    switch (source) {
      case 'camera':
        return CameraSource.Camera;
      case 'photos':
        return CameraSource.Photos;
      case 'prompt':
        return CameraSource.Prompt;
      default:
        return CameraSource.Prompt;
    }
  }

  private static getCameraResultType(resultType?: 'uri' | 'base64' | 'dataUrl'): CameraResultType {
    switch (resultType) {
      case 'uri':
        return CameraResultType.Uri;
      case 'base64':
        return CameraResultType.Base64;
      case 'dataUrl':
        return CameraResultType.DataUrl;
      default:
        return CameraResultType.Uri;
    }
  }

  static async capturePhoto(options: CameraOptions = {}): Promise<CapturedPhoto> {
    if (isNativePlatform() && isPluginAvailable('Camera')) {
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        throw new Error('Camera permission denied');
      }

      try {
        const photo: Photo = await Camera.getPhoto({
          quality: options.quality ?? 90,
          allowEditing: options.allowEditing ?? false,
          resultType: this.getCameraResultType(options.resultType),
          source: this.getCameraSource(options.source),
          width: options.width,
          height: options.height,
          correctOrientation: options.correctOrientation ?? true,
          saveToGallery: options.saveToGallery ?? false,
        });

        return {
          dataUrl: photo.dataUrl,
          base64String: photo.base64String,
          path: photo.path,
          webPath: photo.webPath ? convertFileSrc(photo.webPath) : undefined,
          format: photo.format,
        };
      } catch (error) {
        console.error('Capacitor Camera error:', error);
        throw new Error('Failed to capture photo');
      }
    } else {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        if (options.source === 'camera') {
          input.capture = 'environment';
        }

        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            reject(new Error('No file selected'));
            return;
          }

          try {
            if (options.resultType === 'base64' || options.resultType === 'dataUrl') {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                if (options.resultType === 'base64') {
                  const base64 = result.split(',')[1];
                  resolve({
                    base64String: base64,
                    format: file.type.split('/')[1],
                  });
                } else {
                  resolve({
                    dataUrl: result,
                    format: file.type.split('/')[1],
                  });
                }
              };
              reader.onerror = () => reject(new Error('Failed to read file'));
              reader.readAsDataURL(file);
            } else {
              const url = URL.createObjectURL(file);
              resolve({
                webPath: url,
                format: file.type.split('/')[1],
              });
            }
          } catch (error) {
            reject(error);
          }
        };

        input.click();
      });
    }
  }

  static async pickImages(options: { limit?: number } = {}): Promise<CapturedPhoto[]> {
    if (isNativePlatform() && isPluginAvailable('Camera')) {
      const hasPermission = await this.checkPermissions();

      if (!hasPermission) {
        throw new Error('Camera permission denied');
      }

      try {
        const result = await Camera.pickImages({
          quality: 90,
          limit: options.limit ?? 10,
        });

        return result.photos.map((photo) => ({
          webPath: photo.webPath ? convertFileSrc(photo.webPath) : undefined,
          path: photo.path,
          format: photo.format,
        }));
      } catch (error) {
        console.error('Capacitor Camera pickImages error:', error);
        throw new Error('Failed to pick images');
      }
    } else {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;

        input.onchange = async (e) => {
          const files = Array.from((e.target as HTMLInputElement).files || []);
          if (files.length === 0) {
            reject(new Error('No files selected'));
            return;
          }

          const limit = options.limit ?? 10;
          const selectedFiles = files.slice(0, limit);

          try {
            const photos = selectedFiles.map((file) => ({
              webPath: URL.createObjectURL(file),
              format: file.type.split('/')[1],
            }));
            resolve(photos);
          } catch (error) {
            reject(error);
          }
        };

        input.click();
      });
    }
  }

  static async convertToBlob(photo: CapturedPhoto): Promise<Blob> {
    if (photo.base64String) {
      const byteCharacters = atob(photo.base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: `image/${photo.format}` });
    }

    if (photo.dataUrl) {
      const response = await fetch(photo.dataUrl);
      return response.blob();
    }

    if (photo.webPath) {
      const response = await fetch(photo.webPath);
      return response.blob();
    }

    throw new Error('No valid photo data to convert to Blob');
  }

  static async convertToFile(photo: CapturedPhoto, fileName: string = 'photo.jpg'): Promise<File> {
    const blob = await this.convertToBlob(photo);
    return new File([blob], fileName, { type: blob.type });
  }
}
