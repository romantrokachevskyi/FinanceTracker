# Play Console compliance answers

Answers to enter in the Console's **App content** and **Data safety** sections.

The app itself still collects nothing: the balance, payday and check-in dates
never leave the device, and the app's own code makes no network calls. Every
answer below that says data is collected or shared describes the **Google Mobile
Ads SDK**, which the app embeds to show one banner after ten days of use.

Source for the ad rows: Google's
[Play data disclosure for the Mobile Ads SDK](https://developers.google.com/admob/android/privacy/play-data-disclosure).
Re-read it before each submission — Google revises it, and the developer, not
Google, is answerable for these answers.

## Data safety

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** — by the ad SDK only |
| Is all user data encrypted in transit? | **Yes** — the Mobile Ads SDK uses TLS |
| Do you provide a way for users to request data deletion? | Uninstalling deletes all on-device data; ad-linked data is reset by clearing the advertising ID in Android settings |
| Is your app's data collection independently validated? | No |

### Data types — all collected and shared by the ad SDK

Each row is **collected**, **shared**, **required** (not optional for the user),
and processed for **advertising, analytics and fraud prevention**.

| Play category | Data type | What it is |
| --- | --- | --- |
| Location | Approximate location | Derived from the IP address the ad request carries |
| Device or other IDs | Device or other IDs | Android advertising ID, app set ID, signed-in account identifiers |
| App activity | App interactions | Ad impressions and clicks |
| App info and performance | Crash logs, Diagnostics | SDK diagnostic information |

**Not collected, and must stay that way:** the user's balance, payday, and
check-in dates. They live in `localStorage`, are never read by the ad SDK, and
are excluded from Auto Backup. No row above covers financial or payment data.

## App content declarations

| Declaration | Answer |
| --- | --- |
| Ads | **Yes, contains ads** |
| In-app purchases | **None** |
| Target audience | **18 and over** |
| Appeals to children | **No** |
| News app | **No** |
| COVID-19 contact tracing or status | **No** |
| Data safety — government app | **No** |
| Financial features | **None of the above.** The app is not a bank, lender, broker, wallet, crypto exchange, or investment service. It performs arithmetic on numbers the user types in. |
| Health apps | **No** |
| Advertising ID permission | **Requested.** The Mobile Ads SDK adds `com.google.android.gms.permission.AD_ID`, used for advertising |

Declaring the target audience as 18+ keeps the app out of the Families
programme and its additional requirements. That matters more now than before:
the Families policy restricts which ad SDKs may be used at all.

## Content rating questionnaire (IARC)

| Category | Answer |
| --- | --- |
| Violence | None |
| Sexuality | None |
| Language | None |
| Controlled substances | None |
| Gambling or simulated gambling | None |
| User-generated content or user interaction | None |
| Shares the user's location with other users | No |
| Allows purchases of digital goods | No |
| Unrestricted internet access (a browser) | No |
| Contains ads, if asked | Yes |

Category: **All other app types**. IARC asks about exposure between users, not
data sent to an ad network — the ad SDK's approximate location and IDs belong in
Data safety above, not here. Expect the lowest age rating in every region.

## Permissions justification

The app's own manifest declares one permission, `INTERNET`. The Google Mobile
Ads SDK merges in eight more. This is the full set in the built manifest,
verified with the command in `verification.md`:

| Permission | Comes from | Why |
| --- | --- | --- |
| `INTERNET` | the app | load the banner |
| `ACCESS_NETWORK_STATE` | Ads SDK | skip ad requests with no connection |
| `com.google.android.gms.permission.AD_ID` | Ads SDK | read the advertising ID |
| `ACCESS_ADSERVICES_AD_ID` | Ads SDK | Android Privacy Sandbox ad ID access |
| `ACCESS_ADSERVICES_ATTRIBUTION` | Ads SDK | Privacy Sandbox conversion attribution |
| `ACCESS_ADSERVICES_TOPICS` | Ads SDK | Privacy Sandbox interest topics |
| `FOREGROUND_SERVICE` | Ads SDK | ad rendering work while the app is visible |
| `WAKE_LOCK` | Ads SDK | keep the screen alive during ad rendering |
| `…DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Play services | internal, self-scoped |

None of them is a runtime permission, so the user is never prompted. If a
reviewer asks why a finance app needs internet access: it bundles all its
assets and contacts no server of its own — every permission above serves
Google's ad module.

`FOREGROUND_SERVICE` draws reviewer attention on its own. It arrives from
`play-services-ads` and the app starts no service of its own; say so if asked.

## Consent

The app calls Google's User Messaging Platform before the first ad request, so
EU, EEA, UK and Swiss users choose personalised or non-personalised ads and no
ad loads before they do. Configure the GDPR message and the privacy options
form in the AdMob console under **Privacy & messaging**; an unconfigured
message means the form never appears and consent is never gathered.
