/**
 * AAMVA Driver's License Barcode Parser
 * Parses PDF417 barcode data from US/Canadian driver's licenses
 *
 * Common AAMVA Data Element IDs:
 * - DAA: Full name
 * - DAC: First name
 * - DAD: Middle name
 * - DCS: Last name
 * - DBB: Date of birth (MMDDCCYY format)
 * - DAQ: Driver license number
 * - DAG: Street address
 * - DAI: City
 * - DAJ: State
 * - DAK: Zip code
 * - DAU: Height
 * - DAY: Eye color
 * - DBD: License issue date
 * - DBA: License expiration date
 */

export interface AAMVAData {
  // Name fields
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;

  // Birth and ID
  dateOfBirth?: string; // YYYY-MM-DD format
  licenseNumber?: string;

  // Address
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;

  // Physical characteristics
  height?: string;
  eyeColor?: string;

  // License dates
  issueDate?: string; // YYYY-MM-DD format
  expirationDate?: string; // YYYY-MM-DD format

  // Raw data for debugging
  raw?: string;
}

/**
 * Parse AAMVA formatted date (MMDDCCYY or CCYYMMDD)
 */
function parseAAMVADate(dateStr: string): string | undefined {
  if (!dateStr || dateStr.length < 8) return undefined;

  try {
    // Try MMDDCCYY format first (most common)
    if (dateStr.length === 8) {
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(2, 4);
      const year = dateStr.substring(4, 8);
      return `${year}-${month}-${day}`;
    }

    // Try CCYYMMDD format
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
  } catch (err) {
    console.error("Failed to parse AAMVA date:", dateStr, err);
  }

  return undefined;
}

/**
 * Extract field value from AAMVA data by tag
 */
function getField(data: string, tag: string): string | undefined {
  const regex = new RegExp(`${tag}([^\n\r]+)`, "i");
  const match = data.match(regex);
  return match?.[1]?.trim();
}

/**
 * Parse AAMVA barcode data into structured format
 */
export function parseAAMVABarcode(barcodeData: string): AAMVAData {
  if (!barcodeData) {
    throw new Error("No barcode data provided");
  }

  // Check for AAMVA header
  if (!barcodeData.includes("ANSI")) {
    throw new Error("Invalid AAMVA barcode format - missing ANSI header");
  }

  const result: AAMVAData = {
    raw: barcodeData,
  };

  // Parse name fields
  result.fullName = getField(barcodeData, "DAA");
  result.firstName = getField(barcodeData, "DAC") || getField(barcodeData, "DCT");
  result.middleName = getField(barcodeData, "DAD");
  result.lastName = getField(barcodeData, "DCS") || getField(barcodeData, "DDE");

  // Parse date of birth
  const dobRaw = getField(barcodeData, "DBB");
  if (dobRaw) {
    result.dateOfBirth = parseAAMVADate(dobRaw);
  }

  // Parse license number
  result.licenseNumber = getField(barcodeData, "DAQ");

  // Parse address
  result.streetAddress = getField(barcodeData, "DAG");
  result.city = getField(barcodeData, "DAI");
  result.state = getField(barcodeData, "DAJ");
  result.zipCode = getField(barcodeData, "DAK");

  // Parse physical characteristics
  result.height = getField(barcodeData, "DAU");
  result.eyeColor = getField(barcodeData, "DAY");

  // Parse license dates
  const issueDateRaw = getField(barcodeData, "DBD");
  if (issueDateRaw) {
    result.issueDate = parseAAMVADate(issueDateRaw);
  }

  const expirationDateRaw = getField(barcodeData, "DBA");
  if (expirationDateRaw) {
    result.expirationDate = parseAAMVADate(expirationDateRaw);
  }

  return result;
}

/**
 * Format parsed AAMVA data for display
 */
export function formatAAMVAData(data: AAMVAData): string {
  const lines: string[] = [];

  if (data.firstName || data.lastName) {
    lines.push(
      `Name: ${[data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ")}`
    );
  } else if (data.fullName) {
    lines.push(`Name: ${data.fullName}`);
  }

  if (data.dateOfBirth) {
    lines.push(`DOB: ${data.dateOfBirth}`);
  }

  if (data.licenseNumber) {
    lines.push(`License: ${data.licenseNumber}`);
  }

  if (data.streetAddress || data.city || data.state) {
    const address = [data.streetAddress, data.city, data.state, data.zipCode]
      .filter(Boolean)
      .join(", ");
    lines.push(`Address: ${address}`);
  }

  return lines.join("\n");
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: string): number | undefined {
  try {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  } catch {
    return undefined;
  }
}

/**
 * Check if person is of legal age (21+)
 */
export function isLegalAge(dateOfBirth: string): boolean {
  const age = calculateAge(dateOfBirth);
  return age !== undefined && age >= 21;
}
