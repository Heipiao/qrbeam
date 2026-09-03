import Foundation
import React
import StoreKit
import UIKit

private actor QRBeamSubscriptionService {
  static let monthlyProductID = "com.leoliu.qrbeamreceiver.pro.monthly"
  static let yearlyProductID = "com.leoliu.qrbeamreceiver.pro.yearly"
  static let productIDs = [monthlyProductID, yearlyProductID]
  static let freeMaxBytes = 1 * 1024 * 1024
  static let proMaxBytes = 5 * 1024 * 1024

  private let defaults = UserDefaults.standard
  private let freeSendDayKey = "qrbeam.membership.free-send-day"
  private let freeSendCountKey = "qrbeam.membership.free-send-count"

  func membershipStatus() async -> [String: Any] {
    var activeTransaction: StoreKit.Transaction?
    for await result in StoreKit.Transaction.currentEntitlements {
      guard case .verified(let transaction) = result,
            Self.productIDs.contains(transaction.productID),
            transaction.revocationDate == nil else {
        continue
      }
      activeTransaction = transaction
      break
    }

    let usage = normalizedFreeUsage()
    var status: [String: Any] = [
      "isPro": activeTransaction != nil,
      "freeSendsUsed": usage,
      "freeSendsRemaining": max(0, 1 - usage),
      "freeMaxBytes": Self.freeMaxBytes,
      "proMaxBytes": Self.proMaxBytes,
    ]
    if let transaction = activeTransaction {
      status["productId"] = transaction.productID
      if let expirationDate = transaction.expirationDate {
        status["expirationDate"] = ISO8601DateFormatter().string(from: expirationDate)
      }
    }
    return status
  }

  func products() async throws -> [[String: Any]] {
    let products = try await Product.products(for: Self.productIDs)
    return products.sorted { lhs, rhs in
      Self.productIDs.firstIndex(of: lhs.id) ?? .max
        < Self.productIDs.firstIndex(of: rhs.id) ?? .max
    }.map { product in
      var value: [String: Any] = [
        "id": product.id,
        "displayName": product.displayName,
        "description": product.description,
        "displayPrice": product.displayPrice,
      ]
      if let period = product.subscription?.subscriptionPeriod {
        value["periodUnit"] = Self.periodUnit(period.unit)
        value["periodValue"] = period.value
      }
      return value
    }
  }

  func purchase(productID: String) async throws -> [String: Any] {
    guard Self.productIDs.contains(productID) else {
      throw NSError(domain: "QRBeam.StoreKit", code: 10, userInfo: [
        NSLocalizedDescriptionKey: NSLocalizedString("store.unknownProduct", comment: "")
      ])
    }
    guard let product = try await Product.products(for: [productID]).first else {
      throw NSError(domain: "QRBeam.StoreKit", code: 11, userInfo: [
        NSLocalizedDescriptionKey: NSLocalizedString("store.unavailable", comment: "")
      ])
    }

    switch try await product.purchase() {
    case .success(let verification):
      guard case .verified(let transaction) = verification else {
        throw NSError(domain: "QRBeam.StoreKit", code: 12, userInfo: [
          NSLocalizedDescriptionKey: NSLocalizedString("store.unverified", comment: "")
        ])
      }
      await transaction.finish()
      return ["outcome": "purchased", "membership": await membershipStatus()]
    case .pending:
      return ["outcome": "pending", "membership": await membershipStatus()]
    case .userCancelled:
      return ["outcome": "cancelled", "membership": await membershipStatus()]
    @unknown default:
      return ["outcome": "unknown", "membership": await membershipStatus()]
    }
  }

  func restore() async throws -> [String: Any] {
    try await AppStore.sync()
    return await membershipStatus()
  }

  func handle(transactionUpdate result: VerificationResult<StoreKit.Transaction>) async -> [String: Any]? {
    guard case .verified(let transaction) = result,
          Self.productIDs.contains(transaction.productID) else {
      return nil
    }
    await transaction.finish()
    return await membershipStatus()
  }

  func authorizeSend(fileSize: Int) async -> [String: Any] {
    guard fileSize >= 0, fileSize <= Self.proMaxBytes else {
      return ["allowed": false, "reason": "file_too_large"]
    }
    let status = await membershipStatus()
    if status["isPro"] as? Bool == true {
      return ["allowed": true, "reason": "pro", "membership": status]
    }
    guard fileSize <= Self.freeMaxBytes else {
      return ["allowed": false, "reason": "free_file_too_large", "membership": status]
    }
    let used = normalizedFreeUsage()
    guard used < 1 else {
      return ["allowed": false, "reason": "free_daily_limit", "membership": status]
    }
    defaults.set(used + 1, forKey: freeSendCountKey)
    return ["allowed": true, "reason": "free", "membership": await membershipStatus()]
  }

  private func normalizedFreeUsage() -> Int {
    let today = Self.localDayKey(Date())
    guard defaults.string(forKey: freeSendDayKey) == today else {
      defaults.set(today, forKey: freeSendDayKey)
      defaults.set(0, forKey: freeSendCountKey)
      return 0
    }
    return max(0, defaults.integer(forKey: freeSendCountKey))
  }

  private static func localDayKey(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  private static func periodUnit(_ unit: Product.SubscriptionPeriod.Unit) -> String {
    switch unit {
    case .day: return "day"
    case .week: return "week"
    case .month: return "month"
    case .year: return "year"
    @unknown default: return "unknown"
    }
  }
}

@objc(QRBeamNative)
final class QRBeamNative: RCTEventEmitter {
  private static let membershipChangedEvent = "QRBeamMembershipChanged"
  private let appGroup = "group.com.leoliu.qrbeam"
  private let metadataName = "pending-share.json"
  private let subscriptionService = QRBeamSubscriptionService()
  private var transactionUpdatesTask: Task<Void, Never>?
  private var hasListeners = false

  override init() {
    super.init()
    transactionUpdatesTask = Task { [weak self] in
      for await result in StoreKit.Transaction.updates {
        guard let self else { return }
        guard let status = await self.subscriptionService.handle(transactionUpdate: result) else {
          continue
        }
        await MainActor.run {
          if self.hasListeners {
            self.sendEvent(withName: Self.membershipChangedEvent, body: status)
          }
        }
      }
    }
  }

  deinit {
    transactionUpdatesTask?.cancel()
  }

  override func supportedEvents() -> [String]! {
    [Self.membershipChangedEvent]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc override static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc func getPendingSharedFile(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      guard let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroup
      ) else {
        throw NSError(domain: "QRBeam", code: 1, userInfo: [
          NSLocalizedDescriptionKey: NSLocalizedString("native.appGroupUnavailable", comment: "")
        ])
      }
      let metadataURL = container.appendingPathComponent(metadataName)
      guard FileManager.default.fileExists(atPath: metadataURL.path) else {
        resolve(nil)
        return
      }
      let data = try Data(contentsOf: metadataURL)
      guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let id = object["id"] as? String,
            let fileName = object["fileName"] as? String,
            let mime = object["mime"] as? String,
            let fileSize = object["fileSize"] as? NSNumber,
            let filePath = object["filePath"] as? String,
            FileManager.default.fileExists(atPath: filePath) else {
        throw NSError(domain: "QRBeam", code: 2, userInfo: [
          NSLocalizedDescriptionKey: NSLocalizedString("native.pendingInvalid", comment: "")
        ])
      }
      resolve([
        "id": id,
        "fileName": fileName,
        "mime": mime,
        "fileSize": fileSize,
        "filePath": filePath,
      ])
    } catch {
      reject("pending_share_error", error.localizedDescription, error)
    }
  }

  @objc func clearPendingSharedFile(
    _ id: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      guard let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroup
      ) else {
        resolve(false)
        return
      }
      let metadataURL = container.appendingPathComponent(metadataName)
      guard FileManager.default.fileExists(atPath: metadataURL.path) else {
        resolve(false)
        return
      }
      let data = try Data(contentsOf: metadataURL)
      let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
      guard object?["id"] as? String == id else {
        resolve(false)
        return
      }
      if let filePath = object?["filePath"] as? String {
        try? FileManager.default.removeItem(atPath: filePath)
      }
      try FileManager.default.removeItem(at: metadataURL)
      resolve(true)
    } catch {
      reject("clear_share_error", error.localizedDescription, error)
    }
  }

  @objc func setIdleTimerDisabled(_ enabled: Bool) {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = enabled
    }
  }

  @objc func getMembershipStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      resolve(await subscriptionService.membershipStatus())
    }
  }

  @objc func getSubscriptionProducts(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      do {
        resolve(try await subscriptionService.products())
      } catch {
        reject("store_products_error", error.localizedDescription, error)
      }
    }
  }

  @objc func purchaseSubscription(
    _ productID: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      do {
        resolve(try await subscriptionService.purchase(productID: productID))
      } catch {
        reject("store_purchase_error", error.localizedDescription, error)
      }
    }
  }

  @objc func restorePurchases(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      do {
        resolve(try await subscriptionService.restore())
      } catch {
        reject("store_restore_error", error.localizedDescription, error)
      }
    }
  }

  @objc func authorizeSend(
    _ fileSize: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      resolve(await subscriptionService.authorizeSend(fileSize: fileSize.intValue))
    }
  }
}
