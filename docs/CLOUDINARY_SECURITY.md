# Cloudinary Security Guide

## Credential Management

### Current Configuration
- Credentials are centralized in `lib/cloudinary.ts`
- All API routes use the centralized `cloudinaryService`
- Credentials are loaded from environment variables only

### Rotation Schedule
**Rotate Cloudinary credentials every 30 days**

### How to Rotate Credentials

1. **Generate new credentials in Cloudinary dashboard:**
   - Go to Settings > Security
   - Generate new API key and secret
   - Keep old credentials active temporarily

2. **Update environment variables:**
   ```bash
   CLOUDINARY_API_KEY=new_key
   CLOUDINARY_API_SECRET=new_secret
   ```

3. **Deploy with new credentials:**
   - Update production environment variables
   - Restart application
   - Verify uploads work correctly

4. **Revoke old credentials:**
   - After confirming new credentials work
   - Revoke old API key in Cloudinary dashboard

### Monitoring
The `cloudinaryService` tracks last rotation date and provides `shouldRotateCredentials()` method to check if rotation is due.

### Security Best Practices
- Never commit credentials to git
- Use different credentials for dev/staging/production
- Enable IP restrictions in Cloudinary dashboard
- Monitor API usage for anomalies
- Set up alerts for failed authentication attempts
