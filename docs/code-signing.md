# macOS code signing and notarization

Release builds for macOS are signed with a **Developer ID Application** certificate and notarized by
Apple. Without both, Gatekeeper blocks the app on first launch, and Squirrel.Mac (which installs updates)
refuses to update it. The [Release workflow](../.github/workflows/release.yml) fails the macOS build if
any of the secrets below are missing.

This is distribution outside the Mac App Store. You need an Apple Developer Program membership, but
nothing gets submitted to App Review.

## 1. Create the Developer ID Application certificate

Only the Account Holder of the developer team can create one.

1. Open **Xcode → Settings → Accounts**, select your Apple ID and team, then **Manage Certificates…**
2. Click **+** and choose **Developer ID Application**.

(Without Xcode: create a certificate signing request in **Keychain Access → Certificate Assistant →
Request a Certificate From a Certificate Authority**, saved to disk, then upload it at
[developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates/add)
choosing **Developer ID Application**, the latest sub-CA, and double-click the downloaded `.cer`.)

Check it's in your keychain with its private key:

```bash
security find-identity -v -p codesigning
# 1) ABCDEF… "Developer ID Application: Your Name (TEAMID1234)"
```

## 2. Export it as a .p12

1. In **Keychain Access → login → My Certificates**, expand **Developer ID Application: …** so the private
   key shows under it.
2. Select the certificate, **File → Export Items…**, save as `.p12` and set a strong password.
3. Base64-encode it for GitHub:

   ```bash
   base64 -i DeveloperID.p12 | pbcopy
   ```

Keep the `.p12` and its password somewhere safe (a password manager), and delete loose copies.

## 3. Create an App Store Connect API key (for notarization)

1. Go to [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api).
2. Under **Team Keys**, click **+**. Name it e.g. "OpenASO notarization", with the **Developer** role.
3. Download the `AuthKey_XXXXXXXXXX.p8`. Apple only lets you download it once.
4. Note the **Key ID** (in the table) and the **Issuer ID** (above the table).

## 4. Add the repository secrets

In **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secret              | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| `CSC_LINK`          | The base64 `.p12` from step 2                            |
| `CSC_KEY_PASSWORD`  | The `.p12` export password                               |
| `APPLE_API_KEY_P8`  | The full contents of the `.p8` file, including the BEGIN/END lines |
| `APPLE_API_KEY_ID`  | The key ID                                               |
| `APPLE_API_ISSUER`  | The issuer ID                                            |

Or with the GitHub CLI:

```bash
base64 -i DeveloperID.p12 | gh secret set CSC_LINK
gh secret set CSC_KEY_PASSWORD
gh secret set APPLE_API_KEY_P8 < AuthKey_XXXXXXXXXX.p8
gh secret set APPLE_API_KEY_ID --body XXXXXXXXXX
gh secret set APPLE_API_ISSUER --body xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## 5. Check a release

After the workflow runs, download the macOS `.dmg` from the draft release, install it, and check:

```bash
codesign --verify --deep --strict --verbose=2 /Applications/OpenASO.app
spctl --assess --type execute --verbose /Applications/OpenASO.app
# /Applications/OpenASO.app: accepted
# source=Notarized Developer ID
```

## Signing local builds

`pnpm dist` signs with the Developer ID certificate in your keychain automatically. It notarizes too if
`APPLE_API_KEY` (the path to the `.p8`), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` are set in your
shell. Otherwise notarization is skipped with a warning, which is fine for trying a build on your own Mac.

## Renewal

Developer ID certificates last five years. Apps signed before the certificate expires keep working, but
new releases need a new certificate: repeat steps 1, 2 and 4. Updates keep working across the switch as
long as the team ID stays the same.
