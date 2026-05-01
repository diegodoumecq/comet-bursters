export function imageDataToBlob(imageData: ImageData): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }

    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
