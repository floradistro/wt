# Customer Creation API Endpoint

## Overview
This document describes the API endpoint needed for the "Add New Customer" feature in the POS.

## Endpoint

```
POST /api/pos/customers
```

## Authentication
Requires Bearer token in Authorization header:
```
Authorization: Bearer {access_token}
```

## Request Body

```json
{
  "vendorId": "string (required)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (optional, but required if phone is not provided)",
  "phone": "string (optional, but required if email is not provided)",
  "dateOfBirth": "string (optional, format: YYYY-MM-DD)"
}
```

## Validation Rules
1. `firstName` and `lastName` are required
2. At least one of `email` or `phone` must be provided
3. `dateOfBirth` must be in format YYYY-MM-DD if provided
4. Email must be valid email format if provided
5. Customer must be unique per vendor (check by email or phone)

## Response

### Success (201 Created)
```json
{
  "customer": {
    "id": "uuid",
    "first_name": "string",
    "last_name": "string",
    "email": "string",
    "phone": "string | null",
    "display_name": "string | null",
    "date_of_birth": "string | null",
    "loyalty_points": 0,
    "loyalty_tier": "bronze",
    "vendor_customer_number": "auto-generated"
  }
}
```

### Error (400 Bad Request)
```json
{
  "error": "Error message describing what went wrong"
}
```

### Error (409 Conflict)
```json
{
  "error": "Customer with this email/phone already exists"
}
```

## Database Schema
The customer should be created in the appropriate customers table with the following:
- Link to vendor via vendor_id
- Initialize loyalty_points to 0
- Set default loyalty_tier (usually "bronze" or your lowest tier)
- Auto-generate vendor_customer_number (sequential or UUID-based)
- Set created_at timestamp

## Usage in Frontend
This endpoint is called from:
- `src/components/pos/POSAddCustomerModal.tsx` (line ~90)

The modal handles:
- Form validation before calling API
- Display of loading state during creation
- Success haptic feedback
- Error display to user
- Automatic customer selection after creation
