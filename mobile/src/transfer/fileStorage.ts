import {ActionSheetIOS} from 'react-native';
import {fromByteArray} from 'base64-js';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {sanitizeFilename} from '../protocol/qrb1';

const RECEIVED_DIRECTORY = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/QRBeam`;

function splitFilename(filename: string): {stem: string; extension: string} {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) {
    return {stem: filename, extension: ''};
  }
  return {stem: filename.slice(0, dot), extension: filename.slice(dot)};
}

export async function saveReceivedFile(bytes: Uint8Array, requestedName: string): Promise<string> {
  if (!(await ReactNativeBlobUtil.fs.exists(RECEIVED_DIRECTORY))) {
    await ReactNativeBlobUtil.fs.mkdir(RECEIVED_DIRECTORY);
  }
  const filename = sanitizeFilename(requestedName);
  const {stem, extension} = splitFilename(filename);
  let path = `${RECEIVED_DIRECTORY}/${filename}`;
  let suffix = 1;
  while (await ReactNativeBlobUtil.fs.exists(path)) {
    path = `${RECEIVED_DIRECTORY}/${stem} (${suffix})${extension}`;
    suffix += 1;
  }
  await ReactNativeBlobUtil.fs.writeFile(path, fromByteArray(bytes), 'base64');
  return path;
}

export function shareLocalFile(path: string, subject?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ActionSheetIOS.showShareActionSheetWithOptions(
      {url: encodeURI(`file://${path}`), subject},
      reject,
      () => resolve(),
    );
  });
}
