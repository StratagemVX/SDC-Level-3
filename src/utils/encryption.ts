
import CryptoJS from 'crypto-js';

// Encrypt message with secret key
export const encryptMessage = (message: string, secretKey: string): string => {
  return CryptoJS.AES.encrypt(message, secretKey).toString();
};

// Decrypt message with secret key
export const decryptMessage = (encryptedMessage: string, secretKey: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedMessage, secretKey);
    const originalMessage = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!originalMessage) {
      throw new Error('Decryption failed');
    }
    
    return originalMessage;
  } catch {
    throw new Error('Invalid secret key');
  }
};

// Generate hash of secret key for verification
export const hashSecretKey = (secretKey: string): string => {
  return CryptoJS.SHA256(secretKey).toString();
};

export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

export const sanitizeFileName = (name: string): string => {
  const cleaned = name.replace(/[\x00-\x1F\x7F]/g, "").replace(/[\\/]/g, "-");
  return cleaned.trim().slice(0, 200) || "payload";
};

export const detectFileCategory = (fileType?: string, fileName?: string): "image" | "video" | "audio" | "document" | "archive" | "file" => {
  const type = fileType || "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf") return "document";
  if (type === "application/zip" || type === "application/x-zip-compressed" || type === "application/x-7z-compressed") return "archive";

  const name = (fileName || "").toLowerCase();
  if (name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".ppt") || name.endsWith(".pptx") || name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".txt") || name.endsWith(".rtf") || name.endsWith(".csv") || name.endsWith(".json")) {
    return "document";
  }
  if (name.endsWith(".zip") || name.endsWith(".7z") || name.endsWith(".rar")) return "archive";
  return "file";
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      let binary = "";
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
      }
      resolve(btoa(binary));
    };
    reader.readAsArrayBuffer(file);
  });
};

export const base64ToBlob = (base64: string, contentType: string): Blob => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
};

export const encryptFilePayload = async (file: File, secretKey: string): Promise<string> => {
  const base64 = await fileToBase64(file);
  return encryptMessage(base64, secretKey);
};

export const decryptFilePayload = (encryptedMessage: string, secretKey: string): string => {
  return decryptMessage(encryptedMessage, secretKey);
};

export const compressImageFile = async (
  file: File,
  options: { maxWidth: number; maxHeight: number; quality: number }
): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;

  const { maxWidth, maxHeight, quality } = options;
  const bitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
    if (scale >= 1) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type, quality)
    );
    if (!blob) return file;

    return new File([blob], file.name, { type: file.type });
  } finally {
    bitmap.close();
  }
};

// Generate a realistic-looking fake message for security
export const generateFakeMessage = (): string => {
  const fakeMessages = [
    "Meeting rescheduled for next Tuesday at 3pm.",
    "Please confirm receipt of the documents I sent last week.",
    "Don't forget to prepare the quarterly report before Friday.",
    "The access codes have been updated as per security protocol.",
    "Your request has been processed. Reference number: SK-29581.",
    "The package will arrive tomorrow between 2-4pm.",
    "Please review the attached contract and sign by end of week.",
    "Your reservation has been confirmed for June 15th.",
    "The system maintenance is scheduled for this weekend.",
    "Remember to update your credentials before the end of month."
  ];
  
  return fakeMessages[Math.floor(Math.random() * fakeMessages.length)];
};

// Calculate remaining time for message TTL
export const calculateRemainingTime = (expiryTime: number): string => {
  const now = Date.now();
  const timeLeft = expiryTime - now;
  
  if (timeLeft <= 0) return "Expired";
  
  const totalSeconds = Math.floor(timeLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  return `${paddedMinutes}:${paddedSeconds}`;
};
