import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
  private let appGroup = "group.com.leoliu.qrbeam"
  private let maxFileSize = 5 * 1024 * 1024
  private let statusLabel = UILabel()
  private let doneButton = UIButton(type: .system)
  private let spinner = UIActivityIndicatorView(style: .large)

  override func viewDidLoad() {
    super.viewDidLoad()
    configureUI()
    receiveSharedFile()
  }

  private func configureUI() {
    view.backgroundColor = UIColor(red: 0.035, green: 0.043, blue: 0.063, alpha: 1)
    statusLabel.text = "正在准备文件…"
    statusLabel.textColor = .white
    statusLabel.font = .systemFont(ofSize: 18, weight: .semibold)
    statusLabel.numberOfLines = 0
    statusLabel.textAlignment = .center

    doneButton.setTitle("完成", for: .normal)
    doneButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
    doneButton.tintColor = UIColor(red: 0.40, green: 0.91, blue: 0.65, alpha: 1)
    doneButton.isHidden = true
    doneButton.addTarget(self, action: #selector(finish), for: .touchUpInside)

    spinner.color = UIColor(red: 0.40, green: 0.91, blue: 0.65, alpha: 1)
    spinner.startAnimating()

    let stack = UIStackView(arrangedSubviews: [spinner, statusLabel, doneButton])
    stack.axis = .vertical
    stack.spacing = 22
    stack.alignment = .center
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
      stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
    ])
  }

  private func receiveSharedFile() {
    let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
      .flatMap { $0.attachments ?? [] }
      .filter { $0.hasItemConformingToTypeIdentifier(UTType.data.identifier) }
    guard providers.count == 1, let provider = providers.first else {
      showResult("请选择一个文件，QRBeam 暂不支持批量发送。", isError: true)
      return
    }

    provider.loadFileRepresentation(forTypeIdentifier: UTType.data.identifier) { [weak self] sourceURL, error in
      guard let self else { return }
      do {
        if let error { throw error }
        guard let sourceURL else { throw ShareError.missingFile }
        try self.persist(sourceURL: sourceURL)
        DispatchQueue.main.async {
          self.showResult("文件已加入 QRBeam。\n请打开 QRBeam，在“手机传手机”中开始发送。", isError: false)
        }
      } catch {
        DispatchQueue.main.async {
          self.showResult(error.localizedDescription, isError: true)
        }
      }
    }
  }

  private func persist(sourceURL: URL) throws {
    let values = try sourceURL.resourceValues(forKeys: [.isDirectoryKey])
    guard values.isDirectory != true else { throw ShareError.directory }
    let attributes = try FileManager.default.attributesOfItem(atPath: sourceURL.path)
    guard let sizeValue = attributes[.size] as? NSNumber else { throw ShareError.missingFile }
    let fileSize = sizeValue.intValue
    guard fileSize <= maxFileSize else { throw ShareError.tooLarge }
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      throw ShareError.appGroup
    }

    let metadataURL = container.appendingPathComponent("pending-share.json")
    if let oldData = try? Data(contentsOf: metadataURL),
       let old = try? JSONSerialization.jsonObject(with: oldData) as? [String: Any],
       let oldPath = old["filePath"] as? String {
      try? FileManager.default.removeItem(atPath: oldPath)
    }
    try? FileManager.default.removeItem(at: metadataURL)

    let id = UUID().uuidString.lowercased()
    let fileName = Self.sanitize(sourceURL.lastPathComponent)
    let destination = container.appendingPathComponent("shared-\(id)-\(fileName)")
    try FileManager.default.copyItem(at: sourceURL, to: destination)

    let type = UTType(filenameExtension: destination.pathExtension)
    let metadata: [String: Any] = [
      "id": id,
      "fileName": fileName,
      "mime": type?.preferredMIMEType ?? "application/octet-stream",
      "fileSize": fileSize,
      "filePath": destination.path,
    ]
    let data = try JSONSerialization.data(withJSONObject: metadata, options: [.sortedKeys])
    try data.write(to: metadataURL, options: .atomic)
  }

  private static func sanitize(_ value: String) -> String {
    let invalid = CharacterSet(charactersIn: "/\\:*?\"<>|").union(.controlCharacters)
    let cleaned = value.components(separatedBy: invalid).joined(separator: "_")
      .trimmingCharacters(in: CharacterSet(charactersIn: " ."))
    return String((cleaned.isEmpty ? "shared-file" : cleaned).prefix(180))
  }

  private func showResult(_ message: String, isError: Bool) {
    spinner.stopAnimating()
    spinner.isHidden = true
    statusLabel.text = message
    statusLabel.textColor = isError ? UIColor(red: 1, green: 0.55, blue: 0.55, alpha: 1) : .white
    doneButton.isHidden = false
  }

  @objc private func finish() {
    extensionContext?.completeRequest(returningItems: nil)
  }
}

private enum ShareError: LocalizedError {
  case missingFile, directory, tooLarge, appGroup

  var errorDescription: String? {
    switch self {
    case .missingFile: return "无法读取共享文件。"
    case .directory: return "QRBeam 暂不支持发送目录。"
    case .tooLarge: return "文件不能超过 5 MiB。"
    case .appGroup: return "QRBeam 共享存储不可用。"
    }
  }
}
