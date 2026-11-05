import { toPng } from "html-to-image";

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/** Turn the image into a PNG file. pixelRatio 2 keeps text sharp on phones. */
export async function renderPng(node: HTMLElement, filename: string) {
  const url = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff" });
  const blob = await (await fetch(url)).blob();
  return { url, file: new File([blob], filename, { type: "image/png" }) };
}

export function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.download = filename;
  a.href = url;
  a.click();
}

/**
 * Opens the phone's share menu (WhatsApp, Facebook, Messages...) with the
 * image attached. Browsers that cannot share files, such as most desktop
 * browsers, download the image instead so it can be attached by hand.
 */
export async function shareOrDownload(
  node: HTMLElement,
  filename: string,
  text: string,
): Promise<ShareOutcome> {
  const { url, file } = await renderPng(node, filename);
  const data: ShareData = { files: [file], title: text, text };
  if (typeof navigator !== "undefined" && navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      // Closing the share menu is not an error.
      if (error instanceof DOMException && error.name === "AbortError")
        return "cancelled";
    }
  }
  download(url, filename);
  return "downloaded";
}

/**
 * Shares several images in one go (WhatsApp and Facebook both accept a set
 * of photos). Falls back to downloading each one.
 */
export async function shareManyOrDownload(
  items: { node: HTMLElement; filename: string }[],
  text: string,
): Promise<ShareOutcome> {
  const rendered = [];
  for (const { node, filename } of items)
    rendered.push(await renderPng(node, filename));
  const data: ShareData = { files: rendered.map((r) => r.file), text };
  if (typeof navigator !== "undefined" && navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        return "cancelled";
    }
  }
  rendered.forEach((r, i) => download(r.url, items[i].filename));
  return "downloaded";
}
