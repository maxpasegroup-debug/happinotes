# Railway deployment

## 1. Create the services

1. Push this repository to GitHub.
2. In Railway, create a new project and deploy the GitHub repository.
3. Set the backend service **Root Directory** to `/backend`.
4. Set its **Config File Path** to `/backend/railway.json`.
5. Add a MongoDB service to the same Railway project.

## 2. Configure backend variables

Do not create a `PORT` variable; Railway supplies it automatically.

```env
NODE_ENV=production
USE_EMBEDDED_MONGODB=false
MONGODB_URI=${{MongoDB.MONGO_URL}}
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
ADMIN_PHONE_NUMBER=+918089239823
ADMIN_EMAIL=arjunmd@email.com
WHATSAPP_OTP_MODE=test
CORS_ORIGINS=
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

`WHATSAPP_OTP_MODE=test` displays the OTP in the app. It is only for testing. Change it when a real WhatsApp OTP provider is connected.

For direct persistent storage on Railway, attach a Volume to the backend service and mount it at `/app/uploads`. Railway automatically supplies `RAILWAY_VOLUME_MOUNT_PATH`; no extra variable is required. Admin-selected covers and MP3 files are then stored in that Volume and served from `/uploads`.

Cloudinary remains optional. If its three variables are configured, Cloudinary is used instead of the Railway Volume.

Razorpay, SMTP, Sentry, and Expo notification variables may remain blank until those integrations are configured.

## 3. Publish and connect the app

1. In the backend service, open **Settings > Networking** and select **Generate Domain**.
2. Confirm `https://YOUR-DOMAIN.railway.app/health` returns a success response.
3. Change `mobile/.env` to:

```env
EXPO_PUBLIC_API_URL=https://YOUR-DOMAIN.railway.app/api
```

4. Restart Expo with `npx expo start --lan --clear`.

Socket.IO uses the same Railway domain and will reconnect automatically. Keep one backend replica unless a shared Socket.IO adapter such as Redis is added.

## 4. Production data

Railway MongoDB starts empty. Local users and books in `.local-mongodb` are not uploaded with GitHub. Create the accounts again or migrate the local database separately. The phone matching `ADMIN_PHONE_NUMBER` becomes the admin after verified signup/login.
