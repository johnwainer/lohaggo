# Push Notifications Security Guide

## VAPID Keys Management

### Current Configuration
- VAPID keys are validated on application startup
- Invalid keys are logged and push notifications are disabled
- Keys are centralized in `lib/notifications/notificationService.ts`

### Key Format
VAPID keys must be 87 characters long, base64url-encoded strings matching: `^[A-Za-z0-9_-]{87}$`

### Generating VAPID Keys

```bash
# Using web-push CLI
npx web-push generate-vapid-keys

# Output:
# Public Key: BN...
# Private Key: ...
```

### Environment Variables

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
```

**IMPORTANT:**
- Public key can be exposed to clients (hence `NEXT_PUBLIC_`)
- Private key must NEVER be exposed to clients
- Use different keys for dev/staging/production

### Rotation Schedule
**Rotate VAPID keys every 90 days or immediately if compromised**

### How to Rotate VAPID Keys

1. **Generate new keys:**
   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Update environment variables:**
   - Keep old keys active temporarily
   - Add new keys to environment
   - Deploy application

3. **Migrate subscriptions:**
   - Users will need to re-subscribe with new keys
   - Old subscriptions will fail gracefully
   - System automatically removes invalid subscriptions

4. **Remove old keys:**
   - After 30 days, remove old keys
   - Monitor logs for failed subscriptions

## Push Subscription Validation

### Schema Validation
All push subscriptions are validated using Zod schema:

```typescript
{
  endpoint: string (valid URL),
  expirationTime: number | null,
  keys: {
    p256dh: string (required),
    auth: string (required)
  }
}
```

### Security Features

1. **Input Validation:**
   - Endpoint must be valid URL
   - Required keys are enforced
   - Invalid subscriptions are rejected

2. **Sanitization:**
   - Only required fields are stored
   - Extra fields are stripped
   - Stored as validated JSON string

3. **Error Handling:**
   - 410/404 responses automatically remove invalid subscriptions
   - Failed sends are logged but don't crash the app
   - Invalid stored subscriptions are cleaned up

4. **Logging:**
   - All subscription operations are logged
   - Invalid formats are tracked
   - Push send failures are monitored

## Monitoring

### Key Metrics to Track
- Push notification send success rate
- Invalid subscription cleanup rate
- VAPID key validation failures
- Subscription endpoint failures (410/404)

### Alerts to Set Up
- VAPID keys not configured (startup warning)
- High rate of invalid subscriptions
- Push send failure rate > 10%
- Subscription endpoint returning 410 (expired)

## Best Practices

1. **Never log full subscriptions** - Contains sensitive endpoint URLs
2. **Validate before storing** - Reject invalid formats immediately
3. **Clean up expired subscriptions** - Remove on 410/404 responses
4. **Monitor send rates** - Track success/failure metrics
5. **Test key rotation** - Have a documented process
6. **Use different keys per environment** - Dev/staging/production isolation
