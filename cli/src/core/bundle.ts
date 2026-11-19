import fs from 'node:fs';
import path from 'node:path';
import { normalizeLf, toPosixPath, walkFiles } from './crypto-fs.ts';
import {
  EMBEDDED_BUNDLE_FILES,
  EMBEDDED_RELEASE_ID,
  EMBEDDED_STANDARD_VERSION
} from '../generated/embedded-bundle.ts';

export interface StandardBundle {
  standardVersion: string;
  releaseId: string;
  files: Readonly<Record<string, string>>;
}

export function loadStandardBundle(customBundleDir?: string): StandardBundle {
  if (!customBundleDir) {
    return {
      standardVersion: EMBEDDED_STANDARD_VERSION,
      releaseId: EMBEDDED_RELEASE_ID,
      files: EMBEDDED_BUNDLE_FILES
    };
  }

  const root = path.resolve(customBundleDir);
  if (!fs.existsSync(root)) {
    throw new Error(`Bundle directory '${root}' does not exist.`);
  }

  const files: Record<string, string> = {};
  for (const dirName of ['standard', 'schemas', 'policies', 'templates', 'adapters']) {
    const absDir = path.join(root, dirName);
    if (!fs.existsSync(absDir)) continue;
    for (const f of walkFiles(absDir)) {
      const rel = toPosixPath(path.relative(root, f));
      files[rel] = normalizeLf(fs.readFileSync(f, 'utf8'));
    }
  }

  let standardVersion = EMBEDDED_STANDARD_VERSION;
  let releaseId = `custom-bundle-${standardVersion}`;
  const manifestPath = path.join(root, 'RELEASE-MANIFEST.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    if (typeof manifest.standard_version === 'string') standardVersion = manifest.standard_version;
    if (typeof manifest.release_id === 'string') releaseId = manifest.release_id;
  }

  return { standardVersion, releaseId, files };
}

export function getBundleFile(bundle: StandardBundle, relPosixPath: string): string {
  const key = toPosixPath(relPosixPath);
  const content = bundle.files[key];
  if (content === undefined) {
    throw new Error(`Required bundle artifact '${key}' not found in Standard Bundle (${bundle.releaseId}).`);
  }
  return content;
}
