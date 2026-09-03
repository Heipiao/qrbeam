# QRBeamReceiver

The React Native iOS receiver is documented in the repository [root README](../README.md).

## QRBeam Pro subscriptions

Both products belong to the `QRBeam Pro` auto-renewable subscription group:

- Monthly: `com.leoliu.qrbeamreceiver.pro.monthly`
- Yearly: `com.leoliu.qrbeamreceiver.pro.yearly`

The free tier can send or receive one transfer per local calendar day, with a
1 MiB file limit. An active QRBeam Pro subscription raises the file limit to
the QRB1 protocol maximum of 5 MiB and removes the daily transfer limit.

The iOS StoreKit 2 bridge loads App Store localized prices, verifies current
entitlements, purchases either product, and restores purchases. The products
must use the identifiers above in App Store Connect before purchase testing.
