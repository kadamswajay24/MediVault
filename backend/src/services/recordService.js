import fs from 'fs';
import path from 'path';

/**
 * Cleanly remove a physical file from the uploads directory.
 */
export const removePhysicalFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.error(`[File Deletion Error]: Could not delete file ${filePath}:`, error.message);
  }
  return false;
};

/**
 * ARCHITECTURAL EXTENSION HOOKS:
 * Prepared interfaces for future BE project phases (Blockchain, IPFS, OCR, Encryption).
 * Keep minimal and modular without running unneeded services in MVP.
 */

export const futureHooks = {
  /**
   * Future hook to compute SHA-256 hash of record and anchor to Ethereum/Hyperledger
   */
  anchorRecordToBlockchain: async (recordData) => {
    // Phase 2: Compute hash & send transaction to Smart Contract
    return {
      status: 'PENDING_IMPLEMENTATION',
      txHash: null,
      timestamp: new Date(),
    };
  },

  /**
   * Future hook to upload encrypted file to IPFS node (Infura / Pinata)
   */
  uploadToIpfs: async (fileBuffer) => {
    // Phase 2: InterPlanetary File System pinned CID
    return {
      status: 'PENDING_IMPLEMENTATION',
      cid: null,
    };
  },

  /**
   * Future hook to extract clinical text using Tesseract OCR or Vision API
   */
  extractTextWithOcr: async (filePath) => {
    // Phase 3: Automated text extraction for lab reports & prescriptions
    return {
      status: 'PENDING_IMPLEMENTATION',
      extractedText: '',
    };
  },
};
