import {toByteArray} from 'base64-js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {sha256} from '@noble/hashes/sha2.js';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {MAX_FILE_SIZE, sanitizeFilename} from '../protocol/qrb1';
import type {PendingSharedFile} from '../native/QRBeamNative';

export interface PreparedFile {
  bytes: Uint8Array;
  fileName: string;
  mime: string;
  fileSize: number;
  sha256: string;
  sharedFileId?: string;
}

export class FileSelectionCancelled extends Error {}

function localPath(uri: string): string {
  return decodeURI(uri.replace(/^file:\/\//, ''));
}

async function readPreparedFile(
  path: string,
  fileName: string,
  mime: string | null | undefined,
  declaredSize?: number | null,
  sharedFileId?: string,
): Promise<PreparedFile> {
  if (declaredSize != null && declaredSize > MAX_FILE_SIZE) {
    throw new Error('Files must be 5 MiB or smaller.');
  }
  const stat = await ReactNativeBlobUtil.fs.stat(path);
  const fileSize = Number(stat.size);
  if (!Number.isSafeInteger(fileSize) || fileSize < 0 || fileSize > MAX_FILE_SIZE) {
    throw new Error('Files must be 5 MiB or smaller.');
  }
  const encoded = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
  const bytes = toByteArray(encoded);
  if (bytes.length !== fileSize) {
    throw new Error('The selected file could not be read completely.');
  }
  return {
    bytes,
    fileName: sanitizeFilename(fileName),
    mime: mime || 'application/octet-stream',
    fileSize,
    sha256: bytesToHex(sha256(bytes)),
    sharedFileId,
  };
}

export async function chooseFile(): Promise<PreparedFile> {
  try {
    const [selected] = await pick({
      type: [types.allFiles],
      allowMultiSelection: false,
      mode: 'import',
      presentationStyle: 'fullScreen',
    });
    if (selected.error != null) throw new Error(selected.error);
    if (selected.size != null && selected.size > MAX_FILE_SIZE) {
      throw new Error('Files must be 5 MiB or smaller.');
    }
    const [copy] = await keepLocalCopy({
      files: [{uri: selected.uri, fileName: sanitizeFilename(selected.name ?? 'shared-file')}],
      destination: 'cachesDirectory',
    });
    if (copy.status !== 'success') throw new Error(copy.copyError);
    return readPreparedFile(
      localPath(copy.localUri),
      selected.name ?? 'shared-file',
      selected.type,
      selected.size,
    );
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      throw new FileSelectionCancelled();
    }
    throw error;
  }
}

export async function preparePendingShare(file: PendingSharedFile): Promise<PreparedFile> {
  return readPreparedFile(
    file.filePath,
    file.fileName,
    file.mime,
    file.fileSize,
    file.id,
  );
}
