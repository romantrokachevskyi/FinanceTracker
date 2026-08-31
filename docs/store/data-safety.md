# Play Console compliance answers

Answers to enter in the Console's **App content** and **Data safety** sections.
Every answer below is true because the app requests no network permission and
disables Auto Backup — see `RELEASE.md` for the verification that confirmed it.

## Data safety

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No** |
| Data types collected | **None** |
| Data types shared | **None** |
| Is all user data encrypted in transit? | Not applicable — no data is transmitted |
| Do you provide a way for users to request data deletion? | Uninstalling deletes all data; no server-side data exists |
| Is your app's data collection independently validated? | No |

The app stores the balance, payday, and check-in date in the device's local
browser storage. Play does not count on-device-only storage as collection, and
nothing is transmitted off the device.

## App content declarations

| Declaration | Answer |
| --- | --- |
| Ads | **No ads** |
| In-app purchases | **None** |
| Target audience | **18 and over** |
| Appeals to children | **No** |
| News app | **No** |
| COVID-19 contact tracing or status | **No** |
| Data safety — government app | **No** |
| Financial features | **None of the above.** The app is not a bank, lender, broker, wallet, crypto exchange, or investment service. It performs arithmetic on numbers the user types in. |
| Health apps | **No** |
| Advertising ID permission | **Not requested** |

Declaring the target audience as 18+ keeps the app out of the Families
programme and its additional requirements. The app is a personal finance tool,
so this is accurate rather than merely convenient.

## Content rating questionnaire (IARC)

| Category | Answer |
| --- | --- |
| Violence | None |
| Sexuality | None |
| Language | None |
| Controlled substances | None |
| Gambling or simulated gambling | None |
| User-generated content or user interaction | None |
| Shares user location | No |
| Allows purchases | No |
| Data sharing with third parties | No |

Expected outcome: **Everyone / PEGI 3 / USK 0**.

## Permissions justification

The app declares **no device permissions**. `INTERNET` is explicitly removed in
`AndroidManifest.xml`. If a reviewer asks why a finance app needs no
permissions: it bundles all its assets and never contacts a server.
