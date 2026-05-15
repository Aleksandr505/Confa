export type CompressedChatImage = {
    file: File;
    width: number;
    height: number;
    sizeBytes: number;
    originalSizeBytes: number;
    originalName: string;
};

const TARGET_BYTES = 512_000;
const MAX_EDGE = 1280;
const MIN_EDGE = 360;
const JPEG_TYPE = 'image/jpeg';

export async function compressImageForChat(file: File): Promise<CompressedChatImage> {
    if (!file.type.startsWith('image/')) {
        throw new Error('Unsupported image type');
    }

    const image = await loadImage(file);
    try {
        let edge = MAX_EDGE;
        let best: EncodedCanvas | null = null;

        while (edge >= MIN_EDGE) {
            const { width, height } = fitWithin(image.width, image.height, edge);
            const canvas = renderImage(image, width, height);

            for (let quality = 0.84; quality >= 0.48; quality -= 0.08) {
                const blob = await canvasToBlob(canvas, JPEG_TYPE, quality);
                const candidate = { blob, width, height };
                if (!best || blob.size < best.blob.size) {
                    best = candidate;
                }
                if (blob.size <= TARGET_BYTES) {
                    return toCompressedFile(file, candidate);
                }
            }

            edge = Math.floor(edge * 0.84);
        }

        if (best && best.blob.size <= TARGET_BYTES) {
            return toCompressedFile(file, best);
        }
        throw new Error('Image is too large after compression');
    } finally {
        URL.revokeObjectURL(image.url);
    }
}

export function formatBytes(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function toCompressedFile(source: File, encoded: EncodedCanvas): CompressedChatImage {
    const file = new File([encoded.blob], replaceExtension(source.name || 'image', 'jpg'), {
        type: JPEG_TYPE,
        lastModified: Date.now(),
    });
    return {
        file,
        width: encoded.width,
        height: encoded.height,
        sizeBytes: file.size,
        originalSizeBytes: source.size,
        originalName: source.name || 'image',
    };
}

function loadImage(file: File): Promise<LoadedImage> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => resolve({ image, url, width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to decode image'));
        };
        image.src = url;
    });
}

function renderImage(source: LoadedImage, width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas is unavailable');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source.image, 0, 0, width, height);
    return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to encode image'));
                }
            },
            type,
            quality,
        );
    });
}

function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
    if (width <= maxEdge && height <= maxEdge) {
        return { width, height };
    }
    const scale = maxEdge / Math.max(width, height);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

function replaceExtension(filename: string, extension: string): string {
    const cleaned = filename.replace(/[\\/]/g, '').trim() || 'image';
    const dot = cleaned.lastIndexOf('.');
    const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
    return `${base}.${extension}`;
}

type LoadedImage = {
    image: HTMLImageElement;
    url: string;
    width: number;
    height: number;
};

type EncodedCanvas = {
    blob: Blob;
    width: number;
    height: number;
};
