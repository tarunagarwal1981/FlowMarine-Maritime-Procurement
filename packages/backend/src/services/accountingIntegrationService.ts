import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface AccountingSystem {
  systemId: string;
  name: string;
  version: string;
  apiEndpoint: string;
  authMethod: 'API_KEY' | 'OAUTH' | 'BASIC_AUTH';
  dataFormat: 'JSON' | 'XML' | 'CSV';
  supportedOperations: string[];
  chartOfAccountsStructure: string;
}

export interface ChartOfAccounts {
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentAccount?: string;
  isActive: boolean;
  description?: string;
  taxCode?: string;
  costCenterRequired: boolean;
}

export interface CostCenter {
  costCenterCode: string;
  name: string;
  description: string;
  parentCostCenter?: string;
  isActive: boolean;
  budget?: number;
  currency?: string;
  manager?: string;
  vesselId?: string;
  department?: string;
}

export interface JournalEntry {
  entryId: string;
  entryDate: Date;
  reference: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  currency: string;
  exchangeRate?: number;
  lineItems: JournalLineItem[];
  source: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  createdBy: string;
  approvedBy?: string;
  reversalEntry?: string;
}

export interface JournalLineItem {
  lineNumber: number;
  accountCode: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  costCenter?: string;
  vesselId?: string;
  supplierId?: string;
  invoiceReference?: string;
  taxCode?: string;
  taxAmount?: number;
}

export interface TrialBalance {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  currency: string;
  asOfDate: Date;
}

export interface FinancialReport {
  reportType: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW' | 'TRIAL_BALANCE' | 'COST_CENTER_REPORT';
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  currency: string;
  data: any;
  generatedDate: Date;
  parameters: Record<string, any>;
}

export interface BudgetAllocation {
  costCenterCode: string;
  accountCode: string;
  budgetPeriod: {
    startDate: Date;
    endDate: Date;
  };
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  currency: string;
}

class AccountingIntegrationService {
  private systems: Map<string, AccountingSystem>;
  private cache: Map<string, { data: any; expiry: number }>;

  constructor() {
    this.systems = new Map();
    this.cache = new Map();
    this.initializeSystems();
  }

  /**
   * Register an accounting system
   */
  registerSystem(system: AccountingSystem): void {
    this.systems.set(system.systemId, system);
    logger.info(`Registered accounting system: ${system.name}`);
  }

  /**
   * Sync chart of accounts from accounting system
   */
  async syncChartOfAccounts(systemId: string): Promise<ChartOfAccounts[]> {
    try {
      const system = this.systems.get(systemId);
      if (!system) {
        throw new AppError('Accounting system not found', 404, 'SYSTEM_NOT_FOUND');
      }

      const cacheKey = `chart_of_accounts_${systemId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const accounts = await this.fetchChartOfAccounts(system);
      this.setCache(cacheKey, accounts, 3600000); // Cache for 1 hour

      logger.info(`Synced ${accounts.length} accounts from ${system.name}`);
      return accounts;
    } catch (error) {
      logger.error('Error syncing chart of accounts:', error);
      throw new AppError('Failed to sync chart of accounts', 500, 'CHART_SYNC_ERROR');
    }
  }

  /**
   * Sync cost centers from accounting system
   */
  async syncCostCenters(systemId: string): Promise<CostCenter[]> {
    try {
      const system = this.systems.get(systemId);
      if (!system) {
        throw new AppError('Accounting system not found', 404, 'SYSTEM_NOT_FOUND');
      }

      const cacheKey = `cost_centers_${systemId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const costCenters = await this.fetchCostCenters(system);
      this.setCache(cacheKey, costCenters, 3600000); // Cache for 1 hour

      logger.info(`Synced ${costCenters.length} cost centers from ${system.name}`);
      return costCenters;
    } catch (error) {
      logger.error('Error syncing cost centers:', error);
      throw new AppError('Failed to sync cost centers', 500, 'COST_CENTER_SYNC_ERROR');
    }
  }

  /**
   * Post journal entry to accounting system
   */
  async postJournalEntry(systemId: string, entry: JournalEntry): Promise<{
    success: boolean;
    entryId: string;
    systemReference?: string;
    errors?: string[];
  }> {
    try {
      const system = this.systems.get(systemId);
      if (!system) {
        throw new AppError('Accounting system not found', 404, 'SYSTEM_NOT_FOUND');
      }

      // Validate journal entry
      const validation = this.validateJournalEntry(entry);
      if (!validation.isValid) {
        return {
          success: false,
          entryId: entry.entryId,
          errors: validation.errors
        };
      }

      const result = await this.submitJournalEntry(system, entry);

      logger.info(`Journal entry posted to ${system.name}:`, {
        entryId: entry.entryId,
        systemReference: result.systemReference,
        amount: entry.totalDebit
      });

      return result;
    } catch (error) {
      logger.error('Error posting journal entry:', error);
      throw new AppError('Failed to post journal entry', 500, 'JOURNAL_POST_ERROR');
    }
  }

  /**
   * Get trial balance from accounting system
   */
  async getTrialBalance(systemId: string, asOfDate: Date, costCenter?: string): Promise<TrialBalance[]> {
    try {
      const system = this.systems.get(systemId);
      if (!system) {
        throw new AppError('Accounting system not found', 404, 'SYSTEM_NOT_FOUND');
      }

      const cacheKey = `trial_balance_${systemId}_${asOfDate.toISOString()}_${costCenter || 'all'}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const trialBalance = await this.fetchTrialBalance(system, asOfDate, costCenter);
      this.setCache(cacheKey, trialBalance, 1800000); // Cache for 30 minutes

      return trialBalance;
    } catch (error) {
      logger.error('Error getting trial balance:', error);
      throw new AppError('Failed to get trial balance', 500, 'TRIAL_BALANCE_ERROR');
    }
  }

  /**
   * Generate financial report
   */
  async generateFinancialReport(
    systemId: string,
    reportType: FinancialReport['reportType'],
    startDate: Date,
    endDate: Date,
    parameters: Record<string, any> = {}
  ): Promise<FinancialReport> {
    try {
      const system = this.systems.get(systemId);
      if (!system) {
        throw new AppError('Accounting system not found', 404, 'SYSTEM_NOT_FOUND');
      }

      const report = await this.fetchFinancialReport(system, reportType, startDate, endDate, parameters);

      logger.info(`Generated ${reportType} report from ${system.name}`, {
        period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        parameters
      });

      return report;
    } catch (error) {
      logger.error('Error generating financial report:', error);
      throw new AppError('Failed to generate financial report', 500, 'REPORT_GENERATION_ERROR');
    }
  }

  /**
   * Sync procurement transactions to accounting system
   */
  async syncProcurementTransactions(systemId: string, transactions: {
    requisitions: any[];
    purchaseOrders: any[];
    invoices: any[];
    payments: any[];
  }): Promise<{
    success: boolean;
    processedCount: number;
    errors: string[];
  }> {
    try {
      const system = this.systems.get(systemId);
      if (!system) {
        throw new AppError('Accounting system not found', 404, 'SYSTEM_NOT_FOUND');
      }

      let processedCount = 0;
      const errors: string[] = [];

      // Process purchase orders as commitments
      for (const po of transactions.purchaseOrders) {
        try {
          const journalEntry = this.createPurchaseOrderEntry(po);
          await this.postJournalEntry(systemId, journalEntry);
          processedCount++;
        } catch (error) {
          errors.push(`PO ${po.poNumber}: ${error.message}`);
        }
      }

      // Process invoices as accounts payable
      for (const invoice of transactions.invoices) {
        try {
          const journalEntry = this.createInvoiceEntry(invoice);
          await this.postJournalEntry(systemId, journalEntry);
          processedCount++;
        } catch (error) {
          errors.push(`Invoice ${invoice.invoiceNumber}: ${error.message}`);
        }
      }

      // Process payments
      for (const payment of transactions.payments) {
        try {
          const journalEntry = this.createPaymentEntry(payment);
          await this.postJournalEntry(systemId, journalEntry);
          processedCount++;
        } catch (error) {
          errors.push(`Payment ${payment.paymentId}: ${error.message}`);
        }
      }

      logger.info(`Synced ${processedCount} transactions to ${system.name}`, {
        errors: errors.length
      });

      return {
        success: errors.length === 0,
        processedCount,
        errors
      };
    } catch (error) {
      logger.error('Error syncing procurement transactions:', error);
      throw new AppError('Failed to sync procurement transactions', 500, 'TRANSACTION_SYNC_ERROR');
    }
  }

  /**
   * Get budget vs actual report
   */
  async getBudgetVsActual(
    systemId: string,
    startDate: Date,
    endDate: Date,
    costCenterCode?: string
  ): Promise<BudgetAllocation[]> {
    try {
      const system = this.systems.get(systemId);
      if (!system) {
        throw new AppError('Accounting system not found', 404, 'SYSTEM_NOT_FOUND');
      }

      const budgetData = await this.fetchBudgetVsActual(system, startDate, endDate, costCenterCode);

      return budgetData;
    } catch (error) {
      logger.error('Error getting budget vs actual:', error);
      throw new AppError('Failed to get budget vs actual', 500, 'BUDGET_ACTUAL_ERROR');
    }
  }

  private initializeSystems(): void {
    const defaultSystems: AccountingSystem[] = [
      {
        systemId: 'quickbooks',
        name: 'QuickBooks Online',
        version: '3.0',
        apiEndpoint: 'https://sandbox-quickbooks.api.intuit.com/v3',
        authMethod: 'OAUTH',
        dataFormat: 'JSON',
        supportedOperations: ['CHART_OF_ACCOUNTS', 'JOURNAL_ENTRIES', 'REPORTS', 'COST_CENTERS'],
        chartOfAccountsStructure: 'HIERARCHICAL'
      },
      {
        systemId: 'xero',
        name: 'Xero',
        version: '2.0',
        apiEndpoint: 'https://api.xero.com/api.xro/2.0',
        authMethod: 'OAUTH',
        dataFormat: 'JSON',
        supportedOperations: ['CHART_OF_ACCOUNTS', 'JOURNAL_ENTRIES', 'REPORTS', 'TRACKING_CATEGORIES'],
        chartOfAccountsStructure: 'FLAT'
      },
      {
        systemId: 'sage',
        name: 'Sage Intacct',
        version: '3.0',
        apiEndpoint: 'https://api.intacct.com/ia/xml/xmlgw.phtml',
        authMethod: 'API_KEY',
        dataFormat: 'XML',
        supportedOperations: ['CHART_OF_ACCOUNTS', 'JOURNAL_ENTRIES', 'REPORTS', 'DIMENSIONS'],
        chartOfAccountsStructure: 'HIERARCHICAL'
      },
      {
        systemId: 'netsuite',
        name: 'NetSuite',
        version: '2023.1',
        apiEndpoint: 'https://rest.netsuite.com/app/site/hosting/restlet.nl',
        authMethod: 'OAUTH',
        dataFormat: 'JSON',
        supportedOperations: ['CHART_OF_ACCOUNTS', 'JOURNAL_ENTRIES', 'REPORTS', 'SUBSIDIARIES', 'DEPARTMENTS'],
        chartOfAccountsStructure: 'HIERARCHICAL'
      }
    ];

    defaultSystems.forEach(system => this.registerSystem(system));
  }

  private async fetchChartOfAccounts(system: AccountingSystem): Promise<ChartOfAccounts[]> {
    const headers = this.buildHeaders(system);
    
    let url: string;
    switch (system.systemId) {
      case 'quickbooks':
        url = `${system.apiEndpoint}/companyid/accounts`;
        break;
      case 'xero':
        url = `${system.apiEndpoint}/Accounts`;
        break;
      case 'sage':
        url = `${system.apiEndpoint}`;
        break;
      case 'netsuite':
        url = `${system.apiEndpoint}?script=customscript_accounts&deploy=customdeploy_accounts`;
        break;
      default:
        throw new AppError('Unsupported accounting system', 400, 'UNSUPPORTED_SYSTEM');
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new AppError(`${system.name} API error: ${response.statusText}`, response.status, 'ACCOUNTING_API_ERROR');
    }

    const data = await response.json();
    return this.parseChartOfAccounts(system, data);
  }

  private async fetchCostCenters(system: AccountingSystem): Promise<CostCenter[]> {
    const headers = this.buildHeaders(system);
    
    let url: string;
    switch (system.systemId) {
      case 'quickbooks':
        url = `${system.apiEndpoint}/companyid/classes`;
        break;
      case 'xero':
        url = `${system.apiEndpoint}/TrackingCategories`;
        break;
      case 'sage':
        url = `${system.apiEndpoint}`;
        break;
      case 'netsuite':
        url = `${system.apiEndpoint}?script=customscript_departments&deploy=customdeploy_departments`;
        break;
      default:
        throw new AppError('Unsupported accounting system', 400, 'UNSUPPORTED_SYSTEM');
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new AppError(`${system.name} API error: ${response.statusText}`, response.status, 'ACCOUNTING_API_ERROR');
    }

    const data = await response.json();
    return this.parseCostCenters(system, data);
  }

  private async submitJournalEntry(system: AccountingSystem, entry: JournalEntry): Promise<{
    success: boolean;
    entryId: string;
    systemReference?: string;
    errors?: string[];
  }> {
    const headers = this.buildHeaders(system);
    const payload = this.formatJournalEntry(system, entry);

    let url: string;
    switch (system.systemId) {
      case 'quickbooks':
        url = `${system.apiEndpoint}/companyid/journalentries`;
        break;
      case 'xero':
        url = `${system.apiEndpoint}/ManualJournals`;
        break;
      case 'sage':
        url = `${system.apiEndpoint}`;
        break;
      case 'netsuite':
        url = `${system.apiEndpoint}?script=customscript_journal&deploy=customdeploy_journal`;
        break;
      default:
        throw new AppError('Unsupported accounting system', 400, 'UNSUPPORTED_SYSTEM');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new AppError(`${system.name} API error: ${response.statusText}`, response.status, 'JOURNAL_API_ERROR');
    }

    const data = await response.json();
    
    return {
      success: true,
      entryId: entry.entryId,
      systemReference: data.id || data.JournalEntryID || data.ManualJournalID
    };
  }

  private async fetchTrialBalance(system: AccountingSystem, asOfDate: Date, costCenter?: string): Promise<TrialBalance[]> {
    const headers = this.buildHeaders(system);
    
    let url: string;
    const dateStr = asOfDate.toISOString().split('T')[0];
    
    switch (system.systemId) {
      case 'quickbooks':
        url = `${system.apiEndpoint}/companyid/reports/TrialBalance?summarize_column_by=Total&start_date=${dateStr}&end_date=${dateStr}`;
        break;
      case 'xero':
        url = `${system.apiEndpoint}/Reports/TrialBalance?date=${dateStr}`;
        break;
      default:
        throw new AppError('Trial balance not supported for this system', 400, 'TRIAL_BALANCE_NOT_SUPPORTED');
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new AppError(`${system.name} API error: ${response.statusText}`, response.status, 'TRIAL_BALANCE_API_ERROR');
    }

    const data = await response.json();
    return this.parseTrialBalance(system, data, asOfDate);
  }

  private async fetchFinancialReport(
    system: AccountingSystem,
    reportType: FinancialReport['reportType'],
    startDate: Date,
    endDate: Date,
    parameters: Record<string, any>
  ): Promise<FinancialReport> {
    const headers = this.buildHeaders(system);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    let url: string;
    switch (system.systemId) {
      case 'quickbooks':
        url = this.buildQuickBooksReportUrl(system.apiEndpoint, reportType, startDateStr, endDateStr, parameters);
        break;
      case 'xero':
        url = this.buildXeroReportUrl(system.apiEndpoint, reportType, startDateStr, endDateStr, parameters);
        break;
      default:
        throw new AppError('Financial reports not supported for this system', 400, 'REPORTS_NOT_SUPPORTED');
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new AppError(`${system.name} API error: ${response.statusText}`, response.status, 'REPORT_API_ERROR');
    }

    const data = await response.json();
    
    return {
      reportType,
      reportPeriod: { startDate, endDate },
      currency: parameters.currency || 'USD',
      data,
      generatedDate: new Date(),
      parameters
    };
  }

  private async fetchBudgetVsActual(
    system: AccountingSystem,
    startDate: Date,
    endDate: Date,
    costCenterCode?: string
  ): Promise<BudgetAllocation[]> {
    // This would be implemented based on the specific accounting system's budget API
    // For now, return empty array
    return [];
  }

  private validateJournalEntry(entry: JournalEntry): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if debits equal credits
    if (Math.abs(entry.totalDebit - entry.totalCredit) > 0.01) {
      errors.push('Debits must equal credits');
    }

    // Validate line items
    let calculatedDebit = 0;
    let calculatedCredit = 0;

    for (const line of entry.lineItems) {
      calculatedDebit += line.debitAmount;
      calculatedCredit += line.creditAmount;

      if (!line.accountCode) {
        errors.push(`Line ${line.lineNumber}: Account code is required`);
      }

      if (line.debitAmount < 0 || line.creditAmount < 0) {
        errors.push(`Line ${line.lineNumber}: Amounts cannot be negative`);
      }

      if (line.debitAmount > 0 && line.creditAmount > 0) {
        errors.push(`Line ${line.lineNumber}: Cannot have both debit and credit amounts`);
      }

      if (line.debitAmount === 0 && line.creditAmount === 0) {
        errors.push(`Line ${line.lineNumber}: Must have either debit or credit amount`);
      }
    }

    // Verify calculated totals match entry totals
    if (Math.abs(calculatedDebit - entry.totalDebit) > 0.01) {
      errors.push('Calculated debit total does not match entry total');
    }

    if (Math.abs(calculatedCredit - entry.totalCredit) > 0.01) {
      errors.push('Calculated credit total does not match entry total');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private createPurchaseOrderEntry(po: any): JournalEntry {
    return {
      entryId: `PO-${po.poNumber}`,
      entryDate: new Date(po.createdAt),
      reference: po.poNumber,
      description: `Purchase Order - ${po.vendor.name}`,
      totalDebit: po.totalAmount,
      totalCredit: po.totalAmount,
      currency: po.currency,
      exchangeRate: po.exchangeRate,
      lineItems: [
        {
          lineNumber: 1,
          accountCode: '1400', // Inventory or Expense account
          description: 'Purchase Order Commitment',
          debitAmount: po.totalAmount,
          creditAmount: 0,
          costCenter: po.vesselId,
          vesselId: po.vesselId,
          supplierId: po.vendorId
        },
        {
          lineNumber: 2,
          accountCode: '2100', // Accounts Payable
          description: 'Purchase Order Commitment',
          debitAmount: 0,
          creditAmount: po.totalAmount,
          costCenter: po.vesselId,
          vesselId: po.vesselId,
          supplierId: po.vendorId
        }
      ],
      source: 'FlowMarine',
      status: 'DRAFT',
      createdBy: 'system'
    };
  }

  private createInvoiceEntry(invoice: any): JournalEntry {
    const lineItems: JournalLineItem[] = [];
    let lineNumber = 1;

    // Expense/Asset lines
    for (const item of invoice.items) {
      lineItems.push({
        lineNumber: lineNumber++,
        accountCode: item.accountCode || '5000', // Default expense account
        description: item.description,
        debitAmount: item.amount,
        creditAmount: 0,
        costCenter: invoice.vesselId,
        vesselId: invoice.vesselId,
        supplierId: invoice.vendorId,
        invoiceReference: invoice.invoiceNumber
      });
    }

    // Tax line (if applicable)
    if (invoice.taxAmount > 0) {
      lineItems.push({
        lineNumber: lineNumber++,
        accountCode: '1200', // Tax Receivable
        description: 'Input Tax',
        debitAmount: invoice.taxAmount,
        creditAmount: 0,
        costCenter: invoice.vesselId,
        vesselId: invoice.vesselId,
        taxCode: invoice.taxCode,
        taxAmount: invoice.taxAmount
      });
    }

    // Accounts Payable line
    lineItems.push({
      lineNumber: lineNumber++,
      accountCode: '2000', // Accounts Payable
      description: `Invoice - ${invoice.vendor.name}`,
      debitAmount: 0,
      creditAmount: invoice.totalAmount,
      costCenter: invoice.vesselId,
      vesselId: invoice.vesselId,
      supplierId: invoice.vendorId,
      invoiceReference: invoice.invoiceNumber
    });

    return {
      entryId: `INV-${invoice.invoiceNumber}`,
      entryDate: new Date(invoice.invoiceDate),
      reference: invoice.invoiceNumber,
      description: `Invoice - ${invoice.vendor.name}`,
      totalDebit: invoice.totalAmount,
      totalCredit: invoice.totalAmount,
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      lineItems,
      source: 'FlowMarine',
      status: 'DRAFT',
      createdBy: 'system'
    };
  }

  private createPaymentEntry(payment: any): JournalEntry {
    return {
      entryId: `PAY-${payment.paymentId}`,
      entryDate: new Date(payment.paymentDate),
      reference: payment.paymentReference,
      description: `Payment - ${payment.vendor.name}`,
      totalDebit: payment.amount,
      totalCredit: payment.amount,
      currency: payment.currency,
      exchangeRate: payment.exchangeRate,
      lineItems: [
        {
          lineNumber: 1,
          accountCode: '2000', // Accounts Payable
          description: `Payment - ${payment.vendor.name}`,
          debitAmount: payment.amount,
          creditAmount: 0,
          costCenter: payment.vesselId,
          vesselId: payment.vesselId,
          supplierId: payment.vendorId
        },
        {
          lineNumber: 2,
          accountCode: '1000', // Cash/Bank account
          description: `Payment - ${payment.vendor.name}`,
          debitAmount: 0,
          creditAmount: payment.amount,
          costCenter: payment.vesselId,
          vesselId: payment.vesselId
        }
      ],
      source: 'FlowMarine',
      status: 'DRAFT',
      createdBy: 'system'
    };
  }

  private parseChartOfAccounts(system: AccountingSystem, data: any): ChartOfAccounts[] {
    // Implementation would vary by accounting system
    // This is a simplified example
    const accounts: ChartOfAccounts[] = [];
    
    const accountsData = data.QueryResponse?.Account || data.Accounts || data.accounts || [];
    
    for (const account of accountsData) {
      accounts.push({
        accountCode: account.AcctNum || account.Code || account.account_code,
        accountName: account.Name || account.name,
        accountType: this.mapAccountType(account.AccountType || account.Type || account.type),
        parentAccount: account.ParentRef?.value || account.ParentAccount,
        isActive: account.Active !== false,
        description: account.Description || account.description,
        costCenterRequired: account.RequireClass || false
      });
    }

    return accounts;
  }

  private parseCostCenters(system: AccountingSystem, data: any): CostCenter[] {
    // Implementation would vary by accounting system
    const costCenters: CostCenter[] = [];
    
    const centersData = data.QueryResponse?.Class || data.TrackingCategories || data.departments || [];
    
    for (const center of centersData) {
      costCenters.push({
        costCenterCode: center.Name || center.code,
        name: center.Name || center.name,
        description: center.Description || center.description || '',
        isActive: center.Active !== false,
        parentCostCenter: center.ParentRef?.value
      });
    }

    return costCenters;
  }

  private parseTrialBalance(system: AccountingSystem, data: any, asOfDate: Date): TrialBalance[] {
    // Implementation would vary by accounting system
    const trialBalance: TrialBalance[] = [];
    
    // This is a simplified parser - actual implementation would be more complex
    const rows = data.QueryResponse?.Rows || data.Reports?.[0]?.Rows || [];
    
    for (const row of rows) {
      if (row.ColData && row.ColData.length >= 3) {
        trialBalance.push({
          accountCode: row.ColData[0].value,
          accountName: row.ColData[1].value,
          accountType: 'ASSET', // Would need to be determined from account mapping
          debitBalance: parseFloat(row.ColData[2].value) || 0,
          creditBalance: parseFloat(row.ColData[3].value) || 0,
          netBalance: (parseFloat(row.ColData[2].value) || 0) - (parseFloat(row.ColData[3].value) || 0),
          currency: 'USD', // Would be determined from system settings
          asOfDate
        });
      }
    }

    return trialBalance;
  }

  private formatJournalEntry(system: AccountingSystem, entry: JournalEntry): any {
    // Format would vary by accounting system
    switch (system.systemId) {
      case 'quickbooks':
        return this.formatQuickBooksJournalEntry(entry);
      case 'xero':
        return this.formatXeroJournalEntry(entry);
      default:
        return entry;
    }
  }

  private formatQuickBooksJournalEntry(entry: JournalEntry): any {
    return {
      TxnDate: entry.entryDate.toISOString().split('T')[0],
      DocNumber: entry.reference,
      PrivateNote: entry.description,
      Line: entry.lineItems.map(line => ({
        Amount: line.debitAmount || line.creditAmount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: {
          PostingType: line.debitAmount > 0 ? 'Debit' : 'Credit',
          AccountRef: {
            value: line.accountCode
          },
          ClassRef: line.costCenter ? {
            value: line.costCenter
          } : undefined
        }
      }))
    };
  }

  private formatXeroJournalEntry(entry: JournalEntry): any {
    return {
      Date: entry.entryDate.toISOString().split('T')[0],
      Narration: entry.description,
      Reference: entry.reference,
      JournalLines: entry.lineItems.map(line => ({
        AccountCode: line.accountCode,
        Description: line.description,
        LineAmount: line.debitAmount || -line.creditAmount,
        TrackingCategories: line.costCenter ? [{
          TrackingCategoryID: line.costCenter
        }] : undefined
      }))
    };
  }

  private buildQuickBooksReportUrl(
    baseUrl: string,
    reportType: FinancialReport['reportType'],
    startDate: string,
    endDate: string,
    parameters: Record<string, any>
  ): string {
    const reportMap = {
      'BALANCE_SHEET': 'BalanceSheet',
      'INCOME_STATEMENT': 'ProfitAndLoss',
      'CASH_FLOW': 'CashFlow',
      'TRIAL_BALANCE': 'TrialBalance'
    };

    const reportName = reportMap[reportType];
    return `${baseUrl}/companyid/reports/${reportName}?start_date=${startDate}&end_date=${endDate}`;
  }

  private buildXeroReportUrl(
    baseUrl: string,
    reportType: FinancialReport['reportType'],
    startDate: string,
    endDate: string,
    parameters: Record<string, any>
  ): string {
    const reportMap = {
      'BALANCE_SHEET': 'BalanceSheet',
      'INCOME_STATEMENT': 'ProfitAndLoss',
      'CASH_FLOW': 'CashFlow',
      'TRIAL_BALANCE': 'TrialBalance'
    };

    const reportName = reportMap[reportType];
    return `${baseUrl}/Reports/${reportName}?date=${endDate}`;
  }

  private mapAccountType(systemType: string): ChartOfAccounts['accountType'] {
    const typeMap: Record<string, ChartOfAccounts['accountType']> = {
      'Asset': 'ASSET',
      'Bank': 'ASSET',
      'Current Asset': 'ASSET',
      'Fixed Asset': 'ASSET',
      'Liability': 'LIABILITY',
      'Current Liability': 'LIABILITY',
      'Long Term Liability': 'LIABILITY',
      'Equity': 'EQUITY',
      'Income': 'REVENUE',
      'Revenue': 'REVENUE',
      'Expense': 'EXPENSE',
      'Cost of Goods Sold': 'EXPENSE'
    };

    return typeMap[systemType] || 'EXPENSE';
  }

  private buildHeaders(system: AccountingSystem): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': system.dataFormat === 'JSON' ? 'application/json' : 'application/xml'
    };

    switch (system.authMethod) {
      case 'API_KEY':
        headers['Authorization'] = `Bearer ${process.env[`${system.systemId.toUpperCase()}_API_KEY`]}`;
        break;
      case 'OAUTH':
        headers['Authorization'] = `Bearer ${process.env[`${system.systemId.toUpperCase()}_ACCESS_TOKEN`]}`;
        break;
      case 'BASIC_AUTH':
        const username = process.env[`${system.systemId.toUpperCase()}_USERNAME`];
        const password = process.env[`${system.systemId.toUpperCase()}_PASSWORD`];
        headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        break;
    }

    return headers;
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }
}

export const accountingIntegrationService = new AccountingIntegrationService();