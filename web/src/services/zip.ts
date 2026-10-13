import JSZip from 'jszip';
import { RecordedTake, SignerConsent } from '../types';

export interface ZipExportManifest {
  version: string;
  export_timestamp: number;
  total_takes: number;
  signers: string[];
  labels: string[];
}

export async function exportSessionZip(
  takes: RecordedTake[],
  consents: SignerConsent[] = []
): Promise<Blob> {
  const zip = new JSZip();

  const signers = Array.from(new Set(takes.map((t) => t.signer_id)));
  const labels = Array.from(new Set(takes.map((t) => t.label)));

  const manifest: ZipExportManifest = {
    version: '1.0.0',
    export_timestamp: Date.now(),
    total_takes: takes.length,
    signers,
    labels,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('consents.json', JSON.stringify(consents, null, 2));

  const takesFolder = zip.folder('takes');
  if (takesFolder) {
    for (const take of takes) {
      const fileName = `${take.signer_id}_${take.label}_${take.take_id}.json`;
      takesFolder.file(fileName, JSON.stringify(take, null, 2));
    }
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function importSessionZip(file: Blob | File): Promise<{
  takes: RecordedTake[];
  consents: SignerConsent[];
  manifest: ZipExportManifest | null;
}> {
  const zip = await JSZip.loadAsync(file);

  let manifest: ZipExportManifest | null = null;
  const manifestFile = zip.file('manifest.json');
  if (manifestFile) {
    const content = await manifestFile.async('string');
    try {
      manifest = JSON.parse(content);
    } catch {
      // ignore
    }
  }

  let consents: SignerConsent[] = [];
  const consentsFile = zip.file('consents.json');
  if (consentsFile) {
    const content = await consentsFile.async('string');
    try {
      consents = JSON.parse(content);
    } catch {
      // ignore
    }
  }

  const takes: RecordedTake[] = [];
  const files = Object.keys(zip.files);

  for (const path of files) {
    if (path.startsWith('takes/') && path.endsWith('.json') && !zip.files[path].dir) {
      const content = await zip.files[path].async('string');
      try {
        const takeObj = JSON.parse(content);
        if (takeObj.take_id && takeObj.signer_id && takeObj.label && Array.isArray(takeObj.frames)) {
          takes.push(takeObj as RecordedTake);
        }
      } catch (e) {
        console.warn(`Failed to parse take file ${path}:`, e);
      }
    }
  }

  return { takes, consents, manifest };
}
