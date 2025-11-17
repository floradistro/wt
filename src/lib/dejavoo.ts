/**
 * Dejavoo SPIN REST API Client for React Native
 * Documentation: https://app.theneo.io/dejavoo/spin/spin-rest-api-methods
 */

import { logger } from '@/utils/logger'

// ============================================================
// TYPES & INTERFACES
// ============================================================

export type DejavooEnvironment = "production" | "sandbox";

export type DejavooPaymentType =
  | "Credit"
  | "Debit"
  | "EBT_Food"
  | "EBT_Cash"
  | "Card"
  | "Cash"
  | "Check"
  | "Gift";

export type DejavooTransactionType = "Sale" | "Return" | "Void" | "Auth" | "Capture";

export type DejavooResultCode = "Ok" | "TerminalError" | "ApiError";

export type DejavooReceiptOption = "No" | "Both" | "Merchant" | "Customer";

export interface DejavooConfig {
  authkey: string;
  tpn: string; // Terminal Profile Number
  environment: DejavooEnvironment;
  timeout?: number; // in minutes (1-720)
}

export interface DejavooSaleRequest {
  amount: number;
  tipAmount?: number;
  paymentType: DejavooPaymentType;
  referenceId: string; // Must be unique within one batch
  invoiceNumber?: string;
  printReceipt?: DejavooReceiptOption;
  getReceipt?: DejavooReceiptOption;
  getExtendedData?: boolean;
  timeout?: number; // SPInProxyTimeout in minutes
}

export interface DejavooReturnRequest {
  amount: number;
  paymentType: DejavooPaymentType;
  referenceId: string;
  invoiceNumber?: string;
  printReceipt?: DejavooReceiptOption;
  getReceipt?: DejavooReceiptOption;
  getExtendedData?: boolean;
}

export interface DejavooVoidRequest {
  referenceId: string; // Reference ID of transaction to void
  printReceipt?: DejavooReceiptOption;
  getReceipt?: DejavooReceiptOption;
}

export interface DejavooAuthRequest {
  amount: number;
  paymentType: DejavooPaymentType;
  referenceId: string;
  invoiceNumber?: string;
  printReceipt?: DejavooReceiptOption;
  getReceipt?: DejavooReceiptOption;
  getExtendedData?: boolean;
}

export interface DejavooGeneralResponse {
  ResultCode: string; // "0" for success
  StatusCode: string; // "0000" for approved
  Message: string;
  DetailedMessage?: string;
}

export interface DejavooTransactionResponse {
  GeneralResponse: DejavooGeneralResponse;
  AuthCode?: string;
  ReferenceId?: string;
  PaymentType?: string;
  TransactionType?: string;
  Amount?: number;
  TipAmount?: number;
  CardType?: string; // Visa, Mastercard, Amex, Discover
  CardLast4?: string;
  CardBin?: string; // First 6 digits
  CardholderName?: string;
  ReceiptData?: string; // Receipt text if getReceipt = 'Yes'
  ExtendedData?: any; // Extended transaction data if getExtendedData = true
}

export interface DejavooErrorResponse {
  GeneralResponse: DejavooGeneralResponse;
  error?: string;
}

// ============================================================
// DEJAVOO API CLIENT
// ============================================================

export class DejavooClient {
  private readonly baseUrl: string;
  private readonly authkey: string;
  private readonly tpn: string;
  private readonly defaultTimeout: number;

  constructor(config: DejavooConfig) {
    this.authkey = config.authkey;
    this.tpn = config.tpn;
    this.defaultTimeout = config.timeout || 120; // 2 minutes default

    // Set base URL based on environment
    this.baseUrl =
      config.environment === "production"
        ? "https://spin.spinpos.net"
        : "https://test.spinpos.net/spin";
  }

  /**
   * Process a sale transaction
   */
  async sale(request: DejavooSaleRequest): Promise<DejavooTransactionResponse> {
    const payload = {
      Amount: request.amount,
      TipAmount: request.tipAmount || 0,
      PaymentType: request.paymentType,
      ReferenceId: request.referenceId,
      InvoiceNumber: request.invoiceNumber,
      PrintReceipt: request.printReceipt ?? "No",
      GetReceipt: request.getReceipt ?? "Both",
      GetExtendedData: request.getExtendedData !== false,
      Tpn: this.tpn,
      Authkey: this.authkey,
      SPInProxyTimeout: request.timeout || this.defaultTimeout,
    };

    return this.makeRequest<DejavooTransactionResponse>("v2/Payment/Sale", payload);
  }

  /**
   * Process a return/refund transaction
   */
  async return(request: DejavooReturnRequest): Promise<DejavooTransactionResponse> {
    const payload = {
      Amount: request.amount,
      PaymentType: request.paymentType,
      ReferenceId: request.referenceId,
      InvoiceNumber: request.invoiceNumber,
      PrintReceipt: request.printReceipt ?? "No",
      GetReceipt: request.getReceipt ?? "Both",
      GetExtendedData: request.getExtendedData !== false,
      Tpn: this.tpn,
      Authkey: this.authkey,
    };

    return this.makeRequest<DejavooTransactionResponse>("v2/Payment/Return", payload);
  }

  /**
   * Void a transaction
   */
  async void(request: DejavooVoidRequest): Promise<DejavooTransactionResponse> {
    const payload = {
      ReferenceId: request.referenceId,
      PrintReceipt: request.printReceipt ?? "No",
      GetReceipt: request.getReceipt ?? "Both",
      Tpn: this.tpn,
      Authkey: this.authkey,
    };

    return this.makeRequest<DejavooTransactionResponse>("v2/Payment/Void", payload);
  }

  /**
   * Authorize a transaction (without capture)
   */
  async auth(request: DejavooAuthRequest): Promise<DejavooTransactionResponse> {
    const payload = {
      Amount: request.amount,
      PaymentType: request.paymentType,
      ReferenceId: request.referenceId,
      InvoiceNumber: request.invoiceNumber,
      PrintReceipt: request.printReceipt ?? "No",
      GetReceipt: request.getReceipt ?? "Both",
      GetExtendedData: request.getExtendedData !== false,
      Tpn: this.tpn,
      Authkey: this.authkey,
    };

    return this.makeRequest<DejavooTransactionResponse>("v2/Payment/Auth", payload);
  }

  /**
   * Make HTTP request to Dejavoo API
   */
  private async makeRequest<T>(endpoint: string, payload: any): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Check for HTTP errors
      if (!response.ok) {
        let errorBody = "";
        let parsedError: any = null;
        try {
          errorBody = await response.text();
          try {
            parsedError = JSON.parse(errorBody);
          } catch (_e) {
            // Not JSON
          }
          logger.error("🔴 DejaVoo API Error Response:", {
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
            parsed: parsedError
          });
        } catch (_e) {
          // Ignore
        }

        throw new DejavooApiError(
          `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
          response.status.toString(),
          response.statusText,
        );
      }

      const data = await response.json();

      // Check for Dejavoo API errors
      if (data.GeneralResponse) {
        const { ResultCode, StatusCode, Message, DetailedMessage } = data.GeneralResponse;

        // ResultCode "0" or StatusCode "0000" indicates success
        if (ResultCode !== "0" && StatusCode !== "0000") {
          throw new DejavooApiError(
            DetailedMessage || Message || "Transaction failed",
            StatusCode,
            ResultCode,
          );
        }
      }

      return data as T;
    } catch (error) {
      if (error instanceof DejavooApiError) {
        throw error;
      }

      // Network or parsing errors
      throw new DejavooApiError(
        error instanceof Error ? error.message : "Unknown error occurred",
        "NETWORK_ERROR",
        "ApiError",
      );
    }
  }

  /**
   * Lightweight ping to check if Dejavoo API is reachable
   * Does NOT send transaction to terminal - just validates API connectivity
   *
   * Use this for real-time health checks and monitoring.
   * For full terminal testing, use testConnection() instead.
   *
   * @throws DejavooApiError if API is unreachable or credentials invalid
   */
  async ping(): Promise<boolean> {
    try {
      // Simple endpoint check - verify we can reach the API
      // We'll use a minimal request that doesn't touch the terminal
      const url = `${this.baseUrl}/v2/Payment/Sale`;

      // Quick HEAD request with timeout to check if endpoint exists
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

      try {
        await fetch(url, {
          method: 'OPTIONS',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If we get any response (even 404 or 405), the API is reachable
        // We're just checking connectivity, not making an actual request
        return true;
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new DejavooApiError(
            'API endpoint timeout - network may be slow or unavailable',
            'TIMEOUT',
            'NetworkError'
          );
        }

        throw new DejavooApiError(
          'Unable to reach Dejavoo API - check network connection',
          'NETWORK_ERROR',
          'ApiError'
        );
      }
    } catch (error) {
      if (error instanceof DejavooApiError) {
        throw error;
      }

      throw new DejavooApiError(
        'Health check failed',
        'PING_ERROR',
        'ApiError'
      );
    }
  }

  /**
   * Test connection to Dejavoo API AND physical terminal
   * Sends a $0.01 sale transaction to verify end-to-end connectivity
   *
   * This tests:
   * 1. API endpoint is reachable
   * 2. Credentials (authkey + TPN) are valid
   * 3. Physical terminal is connected and responsive
   * 4. Terminal can process transactions
   *
   * Note: This will display on the physical terminal and require user to cancel/swipe
   *
   * @throws DejavooApiError with specific error details
   */
  async testConnection(): Promise<boolean> {
    try {
      // Send a $0.01 test transaction to the terminal
      // This will show up on the physical device
      const testRef = `TEST-${Date.now()}`;

      await this.sale({
        amount: 0.01,
        paymentType: "Credit",
        referenceId: testRef,
        printReceipt: "No",
        getReceipt: "No",
        getExtendedData: false,
      });

      // If we got a response (even declined), the terminal is working
      return true;
    } catch (error) {
      // Check if it's a terminal error vs network error
      if (error instanceof DejavooApiError) {
        // Terminal errors (timeout, unavailable, etc.) mean we reached the API
        // but the terminal isn't responding
        if (error.isTimeout()) {
          logger.warn("⚠️ Terminal timeout", { error: error.message, statusCode: error.statusCode });
          throw new DejavooApiError(
            "Terminal did not respond in time. Check that the terminal is:\n• Powered on\n• Connected to network\n• Not processing another transaction",
            error.statusCode,
            error.resultCode,
          );
        }

        if (error.isTerminalUnavailable()) {
          logger.warn("⚠️ Terminal unavailable", { error: error.message, statusCode: error.statusCode });
          throw new DejavooApiError(
            "Terminal is not available. Check that the terminal is:\n• Powered on\n• Connected to network\n• Registered with correct TPN",
            error.statusCode,
            error.resultCode,
          );
        }

        // Other API errors might mean credentials are wrong
        logger.error("❌ Terminal test failed - API error", {
          error: error.message,
          statusCode: error.statusCode,
          resultCode: error.resultCode,
        });
        throw new DejavooApiError(
          `API Error: ${error.message}\n\nCheck that:\n• Auth key is correct\n• TPN (Terminal Profile Number) is correct\n• Terminal is assigned to this merchant account`,
          error.statusCode,
          error.resultCode,
        );
      }

      // Network errors mean we can't reach the API at all
      logger.error("❌ Terminal test failed - Network error", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown network error";
      throw new Error(
        `Unable to reach Dejavoo API: ${errorMsg}\n\nCheck your internet connection and firewall settings.`,
      );
    }
  }
}

// ============================================================
// ERROR HANDLING
// ============================================================

export class DejavooApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: string,
    public readonly resultCode: string,
  ) {
    super(message);
    this.name = "DejavooApiError";
  }

  /**
   * Check if error is due to declined transaction
   */
  isDeclined(): boolean {
    return this.statusCode !== "0000" && this.resultCode === "0";
  }

  /**
   * Check if error is due to terminal error
   */
  isTerminalError(): boolean {
    return this.resultCode === "TerminalError";
  }

  /**
   * Check if error is due to API error
   */
  isApiError(): boolean {
    return this.resultCode === "ApiError";
  }

  /**
   * Check if error is due to timeout
   */
  isTimeout(): boolean {
    return this.statusCode === "2007" || this.message.includes("timeout");
  }

  /**
   * Check if terminal is unavailable
   */
  isTerminalUnavailable(): boolean {
    return this.statusCode === "2011" || this.statusCode === "2001";
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Generate a unique reference ID for Dejavoo transactions
 */
export function generateReferenceId(prefix = "TXN"): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${prefix}-${timestamp}-${random}`.substring(0, 50); // Max 50 chars
}

/**
 * Format amount for Dejavoo (must be positive number with max 2 decimals)
 */
export function formatAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Parse Dejavoo card type to standard format
 */
export function parseCardType(cardType?: string): string | null {
  if (!cardType) return null;

  const normalized = cardType.toLowerCase();

  if (normalized.includes("visa")) return "Visa";
  if (normalized.includes("mastercard") || normalized.includes("master")) return "Mastercard";
  if (normalized.includes("amex") || normalized.includes("american")) return "American Express";
  if (normalized.includes("discover")) return "Discover";
  if (normalized.includes("jcb")) return "JCB";

  return cardType;
}

/**
 * Convert status code to human-readable message
 */
export function getStatusMessage(statusCode: string): string {
  const statusMessages: Record<string, string> = {
    "0000": "Approved",
    "2007": "Transaction timeout",
    "2011": "Terminal not available",
    "2301": "Invalid request",
  };

  return statusMessages[statusCode] || `Unknown status: ${statusCode}`;
}

export default DejavooClient;
