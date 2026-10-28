# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Emergency contact SMS alerts

Emergency contacts are stored in Supabase and protected by row-level security. After an emergency report is saved, the `send-emergency-alert` Edge Function sends an SMS to those contacts using Twilio. The app does not contain Twilio credentials.

To enable SMS delivery:

1. Create a Twilio account and obtain an SMS-capable Twilio phone number. Trial accounts may only send to verified recipient numbers.
2. Apply the SQL migrations in `supabase/migrations/` to your Supabase project using the SQL Editor or the Supabase CLI. They create the contacts table and allow users to log alerts only for emergency reports they own.
3. In the Supabase Dashboard, open **Edge Functions**, create a function named `send-emergency-alert`, paste in `supabase/functions/send-emergency-alert/index.ts`, and deploy it.
4. In the Supabase Dashboard, add these Edge Function secrets under **Project Settings → Edge Functions → Secrets**:
   - `TWILIO_ACCOUNT_SID` — the Account SID from the Twilio Console.
   - `TWILIO_AUTH_TOKEN` — the Auth Token from the Twilio Console. Keep it private.
   - `TWILIO_FROM_NUMBER` — the Twilio SMS-capable sender number in international format, such as `+15551234567`.
5. Redeploy the function after setting the secrets.

No Twilio package or mobile app installation is required. Recipient phone numbers should include their country code (E.164 format, for example `+27821234567`). The function only sends to contacts saved for the authenticated user and accepts up to five contacts per emergency alert. A successful Twilio API response means the SMS was accepted for sending; carrier delivery can still vary.

## Registration and OTP verification

Registration collects first and last name, email (entered twice), phone, and password (entered twice). Users choose whether Supabase sends the sign-up OTP by email or SMS. After verification, the app creates the user's `profiles` row, signs out the temporary verification session, and returns to login; the user must log in with the verified email or phone number and password to access the app. The app checks passwords for at least 8 characters, one uppercase letter, one lowercase letter, and one number. When signed out, launching the app opens the login screen; an existing signed-in session is preserved.

Configure Supabase before testing registration:

1. In **Authentication → Providers**, enable Email and Phone sign-ups. In **Authentication → Email Templates → Confirm signup**, remove `{{ .ConfirmationURL }}` and all hyperlinks; use only plain text with the OTP variable, for example: `Your 6-digit code is: {{ .Token }}`. SMS verification requires a configured SMS provider and an SMS template that includes `{{ .Code }}`.
2. In **Authentication → Settings / Security**, require email and phone confirmation, set the minimum password length to 8, and require uppercase, lowercase, and numeric characters. Client validation improves feedback, but Supabase must enforce these rules server-side.
3. Ensure the SMS provider is configured if users can choose SMS. SMS provider charges and regional delivery requirements may apply.
4. Configure custom SMTP in **Project Settings → Auth → SMTP Settings** to deliver email OTPs to users outside your Supabase organization's team. Choose an SMTP provider, verify its sender domain, and enter its host, port, username, password, and sender address in Supabase. Supabase's default SMTP service is limited to authorized team addresses and low-volume testing. If signup reports that it could not send the confirmation email, fix SMTP/provider settings first, then return to the verification screen and choose **Resend code**; don't repeatedly submit the registration form.

Phone numbers are required in international E.164 format (for example, `+27821234567`). With email verification selected, the email is the account sign-in identifier; with SMS verification selected, the phone number is the account sign-in identifier. In either case, the other contact detail is retained in user metadata and is not represented as verified unless that method is separately verified.

Profile rows are created after OTP verification using the `first_name`, `last_name`, and `phone_number` fields, then checked before emergency reports are saved. Apply all SQL migrations in `supabase/migrations/` to the Supabase project; the profile RLS migration allows signed-in users to create and read only their own profile.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
