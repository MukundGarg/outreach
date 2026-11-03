import fs from 'node:fs';
import path from 'node:path';

interface ManifestSchema {
  version: string;
  manifest_version: number;
  action?: {
    default_popup?: string;
  };
  content_scripts?: Array<{
    js?: string[];
  }>;
}

function validateExtension(extensionDir: string) {
  console.log(`[Validate Extension] Checking directory: ${extensionDir}`);
  if (!fs.existsSync(extensionDir)) {
    console.error(`ERROR: Directory does not exist: ${extensionDir}`);
    process.exit(1);
  }

  const manifestPath = path.join(extensionDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`ERROR: manifest.json missing in ${extensionDir}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(manifestPath, 'utf8');
  let manifest: ManifestSchema;
  try {
    manifest = JSON.parse(raw) as ManifestSchema;
    console.log(`✓ manifest.json is valid JSON (version: ${manifest.version}, manifest_version: ${manifest.manifest_version})`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid JSON';
    console.error(`ERROR: manifest.json is not valid JSON: ${msg}`);
    process.exit(1);
  }

  // Check popup files
  if (manifest.action?.default_popup) {
    const popupPath = path.join(extensionDir, manifest.action.default_popup);
    if (!fs.existsSync(popupPath)) {
      console.error(`ERROR: default_popup file missing: ${popupPath}`);
      process.exit(1);
    }
    console.log(`✓ default_popup found: ${manifest.action.default_popup}`);
  }

  // Check content scripts
  if (Array.isArray(manifest.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      for (const js of cs.js || []) {
        const jsPath = path.join(extensionDir, js);
        if (!fs.existsSync(jsPath)) {
          console.error(`ERROR: Content script missing: ${jsPath}`);
          process.exit(1);
        }
        console.log(`✓ content script found: ${js}`);
      }
    }
  }

  console.log('✓ All referenced extension assets exist and are readable.');
}

const targetDir = process.argv[2] || path.resolve(__dirname, '../extension');
validateExtension(targetDir);
