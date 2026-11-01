// Print or share a page made from HTML (reports, QR posters). The phone turns it into a PDF.
// A4 page size. The browser preview opens the page in a new tab and prints it.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const A4 = { width: 595, height: 842 };

export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function printInBrowser(html: string) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Allow pop-ups to print.');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

/** Opens the phone's print screen (printers, or Save as PDF). */
export async function printHtml(html: string) {
  if (Platform.OS === 'web') return printInBrowser(html);
  await Print.printAsync({ html, ...A4 });
}

/** Makes a PDF and opens the share sheet (WhatsApp, email, Files…). */
export async function sharePdf(html: string, title: string) {
  if (Platform.OS === 'web') return printInBrowser(html);
  const { uri } = await Print.printToFileAsync({ html, ...A4 });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this phone.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}

/** Page frame with the MediArca look (system font, #1d1d1f text, light borders). */
export const pageHtml = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1d1d1f; font-size: 11px; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -0.3px; }
  .muted { color: #86868b; }
  .brand { color: #0066cc; font-weight: 600; font-size: 12px; margin-bottom: 10px; }
  .tiles { display: flex; gap: 8px; margin: 14px 0; }
  .tile { flex: 1; border: 1px solid #e5e5ea; border-radius: 12px; padding: 10px; }
  .tile b { display: block; font-size: 16px; margin-bottom: 2px; }
  h2 { font-size: 13px; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 600; color: #86868b; border-bottom: 1px solid #d2d2d7; padding: 5px 4px; }
  td { border-bottom: 1px solid #f0f0f2; padding: 5px 4px; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .r { text-align: right; }
</style></head><body>${body}</body></html>`;
