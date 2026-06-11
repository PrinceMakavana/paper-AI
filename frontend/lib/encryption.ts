import * as CryptoJS from "crypto-js";

export interface DecrytpData {
  data: unknown;
  message: string;
  status_code: number;
  request_status_code: number;
}

export interface ConfigDataType {
  CreateSecureKey: string | undefined;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL;
export const CreateSecureKey = process.env.NEXT_PUBLIC_SECURE_KEY;
export const encryptionLength =
  Number(process.env.NEXT_PUBLIC_ENCRYPTION_LENGTH) || 120;
export const configData: ConfigDataType = {
  CreateSecureKey: process.env.NEXT_PUBLIC_SECURE_KEY,
};

function createSecureKey() {
  return new Promise(async (resolve)  => {
    let result = "";
    const characters: string = configData.CreateSecureKey!;
    const charactersLength: number = characters?.length;
    let counter = 0;
    while (counter < encryptionLength) {
      result += characters?.charAt(
        Math.floor(Math.random() * charactersLength)
      );
      counter += 1;
    }
    resolve(result);
  });
}

export async function encryptData<T>(data: T) {
  try {
    if (typeof data === "object" && data !== null) {
      const dataKeys = Object.keys(data);
      const dataToEncrypt: Record<string, unknown> = {};
      const fileData: Record<string, unknown> = {};
      for (const key of dataKeys) {
        if (!(data[key as keyof T] instanceof File)) {
          dataToEncrypt[key] = data[key as keyof T];
        } else {
          fileData[key] = data[key as keyof T];
        }
      }
      if (Object.keys(dataToEncrypt).length === 0) {
        return {
          ...fileData,
        };
      }
      const encKey = (await createSecureKey()) as string;
      const encrypt = CryptoJS.AES.encrypt(
        JSON.stringify(dataToEncrypt),
        encKey
      ).toString();
      const requestData = {
        secret_text: encKey + encrypt,
        ...fileData,
      };
      return requestData;
    }

    const encKey = (await createSecureKey()) as string;
    const encrypt = CryptoJS.AES.encrypt(
      JSON.stringify(data),
      encKey
    ).toString();

    return { secret_text: encKey + encrypt };
  } catch (error) {
    return error;
  }
}

export function decryptData(encryptedString: string): Promise<unknown> {
  return new Promise(async (resolve, reject) => {
    try {
      const length = encryptionLength;
      const CryptoSecretKey = encryptedString.substring(0, length).toString();
      const data = encryptedString
        .substring(length, encryptedString?.length)
        .toString();
      const bytes = CryptoJS.AES.decrypt(data, CryptoSecretKey);
      if (!bytes) {
        reject("Invalid decrypted data");
        return;
      }
      const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      resolve(decryptedData);
    } catch (error: unknown) {
      reject(error);
    }
  });
}
