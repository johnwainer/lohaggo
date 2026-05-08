import crypto from 'crypto'
import { env } from './env'

interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
}

interface CloudinaryUploadResult {
  url: string
  publicId: string
}

class CloudinaryService {
  private config: CloudinaryConfig | null = null
  private isConfigured: boolean = false
  private lastRotation: Date | null = null
  private readonly ROTATION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000

  constructor() {
    this.loadConfig()
  }

  private loadConfig(): void {
    const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const apiKey = env.CLOUDINARY_API_KEY
    const apiSecret = env.CLOUDINARY_API_SECRET

    if (cloudName && apiKey && apiSecret) {
      this.config = { cloudName, apiKey, apiSecret }
      this.isConfigured = true
      this.lastRotation = new Date()
    }
  }

  public isEnabled(): boolean {
    return this.isConfigured && this.config !== null
  }

  public shouldRotateCredentials(): boolean {
    if (!this.lastRotation) return false
    const now = new Date()
    return (now.getTime() - this.lastRotation.getTime()) > this.ROTATION_INTERVAL_MS
  }

  private generateSignature(params: Record<string, string | number>): string {
    if (!this.config) {
      throw new Error('Cloudinary not configured')
    }

    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')

    return crypto
      .createHash('sha256')
      .update(sortedParams + this.config.apiSecret)
      .digest('hex')
  }

  public async upload(
    file: File,
    folder: string = 'lohaggo',
    resourceType: 'image' | 'raw' = 'image'
  ): Promise<CloudinaryUploadResult> {
    if (!this.isEnabled() || !this.config) {
      throw new Error('Cloudinary service is not configured')
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const timestamp = Math.floor(Date.now() / 1000)

    const params = {
      folder,
      timestamp,
    }

    const signature = this.generateSignature(params)

    const formData = new FormData()
    formData.append('file', new Blob([buffer], { type: file.type || 'application/octet-stream' }))
    formData.append('folder', folder)
    formData.append('timestamp', timestamp.toString())
    formData.append('api_key', this.config.apiKey)
    formData.append('signature', signature)

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${resourceType}/upload`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Cloudinary upload failed: ${errorText}`)
      }

      const data = await response.json()
      return {
        url: data.secure_url,
        publicId: data.public_id,
      }
    } catch (error) {
      throw new Error(`Failed to upload to Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async delete(publicId: string): Promise<void> {
    if (!this.isEnabled() || !this.config) {
      throw new Error('Cloudinary service is not configured')
    }

    const timestamp = Math.floor(Date.now() / 1000)

    const params = {
      public_id: publicId,
      timestamp,
    }

    const signature = this.generateSignature(params)

    const formData = new FormData()
    formData.append('public_id', publicId)
    formData.append('timestamp', timestamp.toString())
    formData.append('api_key', this.config.apiKey)
    formData.append('signature', signature)

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/destroy`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Cloudinary delete failed: ${errorText}`)
      }
    } catch (error) {
      throw new Error(`Failed to delete from Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export const cloudinaryService = new CloudinaryService()
