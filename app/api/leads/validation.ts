function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

export function isValidImage(bytes: Uint8Array, contentType: string) {
  const jpeg = hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  const png = hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && hasPrefix(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
  return (contentType === "image/jpeg" && jpeg) || (contentType === "image/png" && png) || (contentType === "image/webp" && webp);
}

export function isValidVideo(bytes: Uint8Array, contentType: string) {
  const webm = hasPrefix(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  const mp4 = bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  return (contentType === "video/webm" && webm) || ((contentType === "video/mp4" || contentType === "video/quicktime") && mp4);
}
