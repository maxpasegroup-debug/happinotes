# HappiNotes Deployment

## Backend on Railway

1. Create a Railway project from the GitHub repository.
2. Set the service root to `backend`.
3. Add environment variables from `backend/.env.example`.
4. Use MongoDB Atlas for `MONGODB_URI`.
5. Deploy with the included `backend/railway.json`.

Production API target:

```text
https://happinotes-api.railway.app/api
```

## Admin on Vercel

1. Create a Vercel project from the GitHub repository.
2. Set the root directory to `admin`.
3. Add:

```text
BACKEND_API_URL=https://happinotes-api.railway.app/api
NEXT_PUBLIC_API_URL=https://happinotes-api.railway.app/api
```

## Cloudinary

Create folders:

```text
happinotes/covers
happinotes/audio
happinotes/chapters
```

Use signed uploads and set credentials in Railway.

## Razorpay

1. Create monthly and yearly plans in Razorpay.
2. Set `RAZORPAY_MONTHLY_PLAN_ID` and `RAZORPAY_YEARLY_PLAN_ID`.
3. Set webhook URL:

```text
https://happinotes-api.railway.app/api/payments/webhook
```

4. Add `RAZORPAY_WEBHOOK_SECRET`.

## Android Build

From `mobile`:

```powershell
eas login
eas build:configure
eas build --platform android --profile production
```
