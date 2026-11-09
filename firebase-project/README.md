# Fresh Orbit website — how it works and how to run it

- **Shop** — <https://freshorbitt.pages.dev> — customers browse, fill a cart, choose a delivery day and time, choose **Pay now by UPI** or **Pay on delivery**, and send the order on WhatsApp. Every order is also saved to the owner dashboard.
- **Owner dashboard** — <https://freshorbitt.pages.dev/admin> — orders and payments, prices and stock, delivery settings, and admins.
- **Privacy note** — `/privacy.html`.

## Where things live

| What | Where |
|---|---|
| Code | GitHub: <https://github.com/MosaSivaMani/fresh-orbit_all> |
| Website hosting (free) | Cloudflare Pages project **freshorbitt** (Workers & Pages). It publishes the `firebase-project/public` folder (build command empty, output directory `firebase-project/public`) and updates by itself about 30 seconds after any change on GitHub. |
| Database and logins (free Spark plan) | Firebase project **fresh-orbit**: Firestore (products, settings, orders, admin list) and Authentication (email + password). |
| Security rules | `firebase-project/firestore.rules`. Changing this file on GitHub does **not** update Firebase: paste it into Firebase → **Firestore → Rules** and press **Publish**. |
| Firebase connection | `public/js/firebase-config.js` (these values are public by design; the rules protect the data). |

## Changing the website

1. Change the files (or ask Claude to).
2. GitHub → **Add file → Upload files** → drag the changed folder (for example `firebase-project`) → **Commit changes**.
3. Cloudflare publishes it in about a minute. Open the site and press **Cmd + Shift + R** (Mac) or **Ctrl + Shift + R** (Windows) to see it.
4. If `firestore.rules` changed, also paste it into Firebase and **Publish** (see above). Upload the code and publish the rules at about the same time: new code with old rules (or old code with new rules) can stop orders from saving to the dashboard. WhatsApp orders still arrive either way.

## Everyday use

| To do this | Go to |
|---|---|
| See new orders, call or WhatsApp the customer | **Orders** (a beep plays and the tab title shows the count when a new order arrives, while the dashboard is open) |
| Send the customer a confirmation with the total and your UPI ID | **Orders** → **Send confirmation** |
| Record a payment | **Orders** → **Paid UPI** (type the 12-digit UTR from your UPI app, optional) or **Paid cash**. Check your UPI app first: the website cannot see payments. Customers put the order code (FO-XXXX) in the UPI note. |
| Find an order | **Orders** → search box: order code, phone, name or UTR |
| Find the customer's house | **Orders** → **📍 Open in Maps** (only when the customer tapped "Use my current location" at checkout) |
| See who has not paid | **Orders** → **Unpaid** |
| Change a price | **Products** → type the new price and press Enter |
| Mark something sold out | **Products** → stock switch off |
| Add a product or photos | **Products** → **+ Add product**, or **Edit** → **+ Add photos** (up to 6 per product; the first is the main photo on the card, **Make main** changes it; customers swipe through them) |
| Pick the home-page "Catch of the day" | **Products** → **Edit** → tick "Catch of the day" |
| Stop orders for the day | **Delivery** → **Orders** switch off → **Save changes** |
| Change the WhatsApp number, UPI ID, areas, charges, timings or banner | **Delivery** → **Save changes** |
| Add an admin | **Admins** → their email and a password → **Create login & add admin**. Firebase emails them a verification link; they must click it before they can sign in. Send them the admin link and password privately. |
| Remove an admin, or send a password reset | **Admins** → ✕ or **Reset password** |

## Admins and security

- The **main owner** (`mosasiva6@gmail.com`) is always an admin and cannot be removed. It is written in two places: `mainOwner()` in `firestore.rules` and `MAIN_OWNER` in `public/js/admin.js`.
- Everyone else is on the **Admins** tab and must have a **verified email**. This stops a stranger from signing up with an admin's email before the real person does.
- Firebase → **Authentication → Settings → User actions → Enable create (sign-up)** must stay **on**, because the Admins tab creates logins. Strangers can create an account, but it can't see or change anything.
- Firebase → **Authentication → Settings → Authorized domains** must list every address the dashboard is opened on (`freshorbitt.pages.dev`, and your own domain once connected).
- Customers can only create orders, and the rules check every order (order code, payment choice, totals add up, phone number format, sizes).

## Connecting your own domain (for example freshorbitt.in or freshorbit.co.in from BigRock)

1. Cloudflare → **Workers & Pages** → **freshorbitt** → **Custom domains** → **Set up a custom domain** → type the domain → follow the steps.
2. Cloudflare asks you to use its nameservers. In BigRock → **Manage Domain** → **Name Servers**, replace them with the two Cloudflare nameservers it shows.
3. Wait (30 minutes to 24 hours). Cloudflare adds free HTTPS on its own.
4. Firebase → **Authentication → Settings → Authorized domains** → add the new domain.
5. Replace `freshorbitt.pages.dev` with the new domain in `public/index.html` (link-preview tags), `public/robots.txt` and `public/sitemap.xml`, then upload to GitHub.

## Costs

Everything is free except the domain. Firestore's free plan allows 50,000 reads and 20,000 writes per day; each shop visit costs roughly 15 to 20 reads. If a limit is reached, the database pauses until the next day (WhatsApp orders still work). Cloudflare Pages' free plan covers a local shop easily. Nothing is charged unless you upgrade Firebase to the Blaze plan yourself.

## Good to know

- Payments go straight from the customer's UPI app to your bank. The site never sees card or bank details and cannot tell whether a payment succeeded: always check your UPI app before pressing **Paid UPI**.
- Uploaded product photos are stored inside the database. The main photo is downloaded on every visit; extra photos (in `photos/{product}`) only when a customer opens that product. Keep to the photos you need; for many products, ask for them to be moved to the `img/` folder instead.
- `firebase.json` and `.firebaserc` are only used if you ever host on Firebase Hosting instead; Cloudflare ignores them. Security headers are in `public/_headers`.
