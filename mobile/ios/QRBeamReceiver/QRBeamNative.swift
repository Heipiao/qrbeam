import Foundation
import React
import UIKit

@objc(QRBeamNative)
final class QRBeamNative: NSObject {
  private let appGroup = "group.com.leoliu.qrbeam"
  private let metadataName = "pending-share.json"

  @objc static func requiresMainQueueSetup() -> Bool {
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
          NSLocalizedDescriptionKey: "QRBeam App Group is unavailable."
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
          NSLocalizedDescriptionKey: "The pending shared file is invalid."
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
}
