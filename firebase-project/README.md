# Fresh Orbit website — setup guide

This folder is the complete Fresh Orbit website:

- **Shop** (`/`) — customers browse, fill a cart and send the order on WhatsApp. Every order is also saved to your owner dashboard.
- **Owner dashboard** (`/admin`) — sign in to see orders, change prices and stock, add products with photos, and edit delivery areas, charges, timings, the WhatsApp number and the banner message. Changes show on the shop within a second.

It runs on **Google Firebase** on the free **Spark** plan. You need a Google account, a computer (Windows, Mac or Linux) and about 30 minutes.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project**. Name it, for example `fresh-orbit`. Google Analytics is optional; you can turn it off.
3. Note the **Project ID** shown under the name (for example `fresh-orbit-a1b2c`). You need it in step 6.

## 2. Turn on the database

1. In the left menu open **Build → Firestore Database** → **Create database**.
2. Choose a location close to your customers, such as **asia-south1 (Mumbai)**. This cannot be changed later.
3. Choose **Start in production mode** → **Create**. (Your own security rules are uploaded in step 7.)

## 3. Turn on owner login and create the owner account

1. Open **Build → Authentication** → **Get started**.
2. Under **Sign-in method** choose **Email/Password**, switch it on, and **Save**.
3. Open the **Users** tab → **Add user**. Enter the shop owner's email and a strong password. This is the login for `/admin`.

4. Open the **Settings** tab → **User actions** and make sure **Enable create (sign-up)** is **ticked**, then **Save**. The dashboard's Admins tab needs it to create logins for other admins. Only the main owner and emails on the admin list can see or change anything, because the security rules check it.

## 4. Connect the website to your project

1. Click the gear icon → **Project settings** → **General**.
2. Under **Your apps** click the **web icon `</>`**. Give it a nickname such as `Fresh Orbit site` and click **Register app**. You don't need to tick Firebase Hosting here.
3. Firebase shows a `firebaseConfig` block. Open `public/js/firebase-config.js` in a text editor (Notepad is fine) and replace each placeholder value with yours. Save the file.

## 5. Set the owner email in the security rules

Open `firestore.rules` and replace `owner@example.com` with the owner email from step 3. Save the file.

These rules let anyone see products and place an order. Only that email can see orders or change prices and settings.

## 6. Install the Firebase tool (one time)

1. Install **Node.js LTS** from <https://nodejs.org>.
2. Open a terminal: **Command Prompt** on Windows, **Terminal** on Mac. Run:
   ```
   npm install -g firebase-tools
   ```
3. Sign in:
   ```
   firebase login
   ```
4. Go into this folder (the one with `firebase.json`) and pick your project:
   ```
   cd path/to/fresh-orbit
   firebase use YOUR-PROJECT-ID
   ```
   Use the Project ID from step 1. This also updates `.firebaserc`.

## 7. Publish

```
firebase deploy
```

When it finishes it prints your site address, for example `https://fresh-orbit-a1b2c.web.app`. Run `firebase deploy` again any time you change a file.

## 8. First sign-in and starting catalogue

1. Open `https://YOUR-SITE.web.app/admin` and sign in with the owner email.
2. Open **Products** → **Load starting catalog**. This adds the 12 starting products and the default delivery settings.
3. Open **Delivery** and check the **WhatsApp number** first. The starting number, 98480 12345, is an example. Then check the areas and charges, and press **Save changes**.

You're live. Share the site address with customers.

## 9. Use your own domain (for example freshorbit.in)

1. Buy the domain from any registrar, such as GoDaddy, Hostinger or Namecheap.
2. In Firebase open **Build → Hosting** → **Add custom domain**, and type the domain.
3. Firebase shows one or two DNS records (type **A** or **TXT**). Add them in your registrar's **DNS settings**.
4. Wait. DNS changes usually take from a few minutes up to 24 hours. Firebase adds the free HTTPS certificate on its own.

---

## Everyday use

| To do this | Go to |
|---|---|
| See new orders, call or WhatsApp the customer, mark confirmed or delivered | `/admin` → **Orders** |
| Change a price | **Products** → type the new price and press Enter |
| Mark something sold out | **Products** → stock switch off |
| Add a product or photo | **Products** → **+ Add product**, or **Edit** on an existing one |
| Pick the home-page "Catch of the day" | **Products** → **Edit** → tick "Catch of the day" |
| Stop orders for the day | **Delivery** → **Orders** switch off → **Save changes** |
| Change the WhatsApp number, areas, charges, timings or banner | **Delivery** → **Save changes** |
| Add an admin | **Admins** → their email and a password → **Create login & add admin**. Send them the admin link, email and password privately. |
| Remove an admin, or send them a password reset | **Admins** → ✕ or **Reset password** next to their name |

Creating logins from the Admins tab needs Firebase → **Authentication → Settings → User actions → Enable create (sign-up)** switched **on**. Anyone could then make an account, but only emails on the admin list can see or change anything; everyone else sees "Not an admin".

The main owner email is written in two places: `mainOwner()` in `firestore.rules` and `MAIN_OWNER` in `public/js/admin.js`. That person is always an admin and cannot be removed from the dashboard. Everyone else is managed on the **Admins** tab.

Photos you upload are shrunk to a small size automatically, so phone photos are fine.

## Costs

The free Spark plan covers a local shop comfortably. Firestore allows 50,000 reads, 20,000 writes and 1 GB of storage per day; Hosting allows 10 GB of storage and 360 MB of downloads per day. Each customer visit costs roughly 15 to 20 reads. If you ever go over a limit, the site pauses until the next day. Nothing is charged unless you upgrade to the paid Blaze plan yourself. A custom domain costs only the registrar's yearly fee.

## Good to know

- Orders reach you on **WhatsApp** and also appear in **Orders**. If the internet drops while a customer orders, the WhatsApp message still goes through.
- Customers pay after you call to confirm. No payment details are handled on the site.
- Until step 4 is done, the site shows the starting catalogue and orders go only to WhatsApp. That is useful for a quick preview.
- To change the owner email later, edit `firestore.rules`, add the new user in Authentication, and run `firebase deploy`.
