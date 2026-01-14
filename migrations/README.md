# Service Request Budget Feature - Migration Guide

## Overview
This migration adds an optional budget field to the service request process, allowing clients to specify their budget when requesting a service. The system validates that the budget meets the minimum price requirements.

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
- Added `budget Float?` field to the `ServiceRequest` model
- The field is optional (nullable) to maintain backward compatibility

### 2. Validation Schema (`lib/validation/schemas.ts`)
- Added `budget` field to `serviceRequestSchema`
- Validation rules:
  - Must be a positive number
  - Maximum value: 100,000,000
  - Optional field

### 3. API Route (`app/api/service-requests/route.ts`)
- Added budget validation logic in the POST endpoint
- Validation rules:
  - **For direct requests (with partnerId)**: Budget must be ≥ partner's specific price
  - **For general requests (without partnerId)**: Budget must be ≥ service base price
- Returns a 400 error if budget is below the minimum required

### 4. Frontend Form (`app/servicios/[slug]/page.tsx`)
- Added budget input field in Step 3 of the service request form
- Features:
  - Number input with currency icon
  - Dynamic placeholder showing minimum required budget
  - Helper text explaining minimum budget requirement
  - Automatically adjusts based on whether a specific partner is selected

## Business Logic

### Budget Validation Rules
1. **Budget is optional**: Clients can submit requests without specifying a budget
2. **If budget is provided**:
   - For **direct requests** (specific partner selected):
     - Budget must be ≥ partner's price for that service
   - For **general requests** (no specific partner):
     - Budget must be ≥ service's base price

### Example Scenarios

#### Scenario 1: General Request
- Service: Plumbing
- Base Price: $50
- Client Budget: $60 ✅ (Valid - above base price)
- Client Budget: $40 ❌ (Invalid - below base price)

#### Scenario 2: Direct Request to Partner
- Service: Plumbing
- Partner's Price: $75
- Client Budget: $80 ✅ (Valid - above partner price)
- Client Budget: $60 ❌ (Invalid - below partner price, even though above base price)

## Database Migration

### SQL Script Location
`migrations/add_budget_to_service_request.sql`

### How to Execute in Supabase

1. **Login to Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Navigate to "SQL Editor" in the left sidebar
   - Click "New query"

3. **Execute Migration**
   - Copy the contents of `migrations/add_budget_to_service_request.sql`
   - Paste into the SQL editor
   - Click "Run" to execute

4. **Verify Migration**
   - Run the verification queries included in the migration file
   - Check that the `budget` column exists in the `ServiceRequest` table

### Migration Script Details

```sql
-- Add budget column
ALTER TABLE "ServiceRequest" 
ADD COLUMN "budget" DOUBLE PRECISION;

-- Add check constraint for positive values
ALTER TABLE "ServiceRequest" 
ADD CONSTRAINT "ServiceRequest_budget_positive" 
CHECK ("budget" IS NULL OR "budget" > 0);
```

### Rollback (if needed)

If you need to undo this migration:

```sql
ALTER TABLE "ServiceRequest" DROP CONSTRAINT IF EXISTS "ServiceRequest_budget_positive";
ALTER TABLE "ServiceRequest" DROP COLUMN IF EXISTS "budget";
```

## Testing Checklist

After deploying these changes, test the following:

- [ ] Create a service request without budget (should work)
- [ ] Create a service request with valid budget (should work)
- [ ] Create a general request with budget below base price (should fail)
- [ ] Create a direct request with budget below partner price (should fail)
- [ ] Create a direct request with budget above partner price (should work)
- [ ] Verify budget is saved correctly in the database
- [ ] Verify budget displays correctly in partner/admin dashboards

## Deployment Steps

1. **Execute SQL Migration in Supabase**
   - Run the SQL script in Supabase SQL Editor
   - Verify the column was added successfully

2. **Deploy Code Changes to Vercel**
   - Commit all changes to Git
   - Push to your repository
   - Vercel will automatically deploy the changes

3. **Verify Deployment**
   - Test the service request flow in production
   - Check that budget validation works correctly

## Files Modified

- `prisma/schema.prisma` - Added budget field to ServiceRequest model
- `lib/validation/schemas.ts` - Added budget validation
- `app/api/service-requests/route.ts` - Added budget validation logic
- `app/servicios/[slug]/page.tsx` - Added budget input field to form
- `migrations/add_budget_to_service_request.sql` - SQL migration script

## Notes

- The budget field is **optional** to maintain backward compatibility
- Existing service requests without budgets will continue to work
- The validation only applies when a budget is provided
- The UI dynamically shows the minimum required budget based on the selected partner
- All error messages are in English as per project requirements

## Support

If you encounter any issues during migration or deployment, check:
1. Supabase logs for database errors
2. Vercel deployment logs for build errors
3. Browser console for frontend errors
4. API response errors for validation issues
