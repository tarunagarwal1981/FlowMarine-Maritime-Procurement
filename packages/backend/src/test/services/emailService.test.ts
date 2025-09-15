import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EmailService } from '@/services/emailService';

// Mock nodemailer
const mockSendMail = vi.fn();
const mockCreateTransporter = vi.fn(() => ({
  sendMail: mockSendMail,
}));

vi.mock('nodemailer', () => ({
  createTransporter: mockCreateTransporter,
}));

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('sendRFQNotification', () => {
    it('should send RFQ notification email to vendor', async () => {
      const rfqData = {
        id: 'rfq-123',
        rfqNumber: 'RFQ-2024-001',
        items: [
          { name: 'Engine Oil', quantity: 10, specifications: 'SAE 15W-40' },
          { name: 'Air Filter', quantity: 2, specifications: 'Heavy duty' },
        ],
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date('2024-03-15'),
        vesselName: 'MV Ocean Explorer',
      };

      const vendorEmail = 'vendor@example.com';
      const vendorName = 'Marine Supplies Ltd';

      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await emailService.sendRFQNotification(rfqData, vendorEmail, vendorName);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: vendorEmail,
        subject: `RFQ Request - ${rfqData.rfqNumber}`,
        html: expect.stringContaining(vendorName),
        attachments: expect.any(Array),
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should handle email sending failure', async () => {
      const rfqData = {
        id: 'rfq-123',
        rfqNumber: 'RFQ-2024-001',
        items: [],
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date('2024-03-15'),
        vesselName: 'MV Ocean Explorer',
      };

      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const result = await emailService.sendRFQNotification(
        rfqData,
        'vendor@example.com',
        'Marine Supplies Ltd'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });
  });

  describe('sendApprovalNotification', () => {
    it('should send approval notification for requisition', async () => {
      const approvalData = {
        requisitionId: 'req-123',
        requisitionNumber: 'REQ-2024-001',
        vesselName: 'MV Ocean Explorer',
        totalAmount: 5000,
        currency: 'USD',
        urgencyLevel: 'URGENT' as const,
        approverName: 'John Smith',
        approverRole: 'Superintendent',
      };

      const approverEmail = 'approver@company.com';

      mockSendMail.mockResolvedValue({ messageId: 'approval-message-id' });

      const result = await emailService.sendApprovalNotification(approvalData, approverEmail);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: approverEmail,
        subject: `Approval Required - ${approvalData.requisitionNumber}`,
        html: expect.stringContaining(approvalData.vesselName),
        priority: 'high', // For urgent requisitions
      });
      expect(result.success).toBe(true);
    });

    it('should set normal priority for routine requisitions', async () => {
      const approvalData = {
        requisitionId: 'req-123',
        requisitionNumber: 'REQ-2024-001',
        vesselName: 'MV Ocean Explorer',
        totalAmount: 500,
        currency: 'USD',
        urgencyLevel: 'ROUTINE' as const,
        approverName: 'John Smith',
        approverRole: 'Superintendent',
      };

      mockSendMail.mockResolvedValue({ messageId: 'routine-message-id' });

      await emailService.sendApprovalNotification(approvalData, 'approver@company.com');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'normal',
        })
      );
    });
  });

  describe('sendDeliveryNotification', () => {
    it('should send delivery confirmation notification', async () => {
      const deliveryData = {
        deliveryId: 'delivery-123',
        purchaseOrderNumber: 'PO-2024-001',
        vesselName: 'MV Ocean Explorer',
        deliveryLocation: 'Port of Hamburg',
        deliveryDate: new Date('2024-02-15'),
        items: [
          { name: 'Engine Oil', quantity: 10, delivered: true },
          { name: 'Air Filter', quantity: 2, delivered: true },
        ],
        confirmedBy: 'Chief Engineer',
      };

      const recipientEmails = ['procurement@company.com', 'finance@company.com'];

      mockSendMail.mockResolvedValue({ messageId: 'delivery-message-id' });

      const result = await emailService.sendDeliveryNotification(deliveryData, recipientEmails);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: recipientEmails.join(', '),
        subject: `Delivery Confirmed - ${deliveryData.purchaseOrderNumber}`,
        html: expect.stringContaining(deliveryData.vesselName),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('sendEmergencyNotification', () => {
    it('should send emergency override notification', async () => {
      const emergencyData = {
        requisitionId: 'req-emergency-123',
        requisitionNumber: 'REQ-EMERGENCY-001',
        vesselName: 'MV Ocean Explorer',
        overrideReason: 'Critical engine failure - immediate parts needed',
        authorizedBy: 'Captain Smith',
        totalAmount: 15000,
        currency: 'USD',
      };

      const managementEmails = ['ceo@company.com', 'fleet-manager@company.com'];

      mockSendMail.mockResolvedValue({ messageId: 'emergency-message-id' });

      const result = await emailService.sendEmergencyNotification(emergencyData, managementEmails);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: managementEmails.join(', '),
        subject: `EMERGENCY OVERRIDE - ${emergencyData.requisitionNumber}`,
        html: expect.stringContaining('EMERGENCY OVERRIDE'),
        priority: 'high',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with secure token', async () => {
      const userData = {
        email: 'user@company.com',
        firstName: 'John',
        lastName: 'Doe',
        resetToken: 'secure-reset-token-123',
      };

      mockSendMail.mockResolvedValue({ messageId: 'reset-message-id' });

      const result = await emailService.sendPasswordResetEmail(userData);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: userData.email,
        subject: 'Password Reset Request - FlowMarine',
        html: expect.stringContaining(userData.resetToken),
      });
      expect(result.success).toBe(true);
    });

    it('should not include sensitive information in logs on failure', async () => {
      const userData = {
        email: 'user@company.com',
        firstName: 'John',
        lastName: 'Doe',
        resetToken: 'secure-reset-token-123',
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSendMail.mockRejectedValue(new Error('Email service unavailable'));

      const result = await emailService.sendPasswordResetEmail(userData);

      expect(result.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      // Ensure token is not logged
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(userData.resetToken)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('sendComplianceAlert', () => {
    it('should send compliance alert for certificate expiration', async () => {
      const complianceData = {
        vesselName: 'MV Ocean Explorer',
        certificateType: 'Safety Certificate',
        expirationDate: new Date('2024-03-01'),
        daysUntilExpiration: 30,
        complianceType: 'SOLAS',
      };

      const complianceOfficerEmails = ['compliance@company.com'];

      mockSendMail.mockResolvedValue({ messageId: 'compliance-message-id' });

      const result = await emailService.sendComplianceAlert(complianceData, complianceOfficerEmails);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: complianceOfficerEmails.join(', '),
        subject: `Compliance Alert - ${complianceData.certificateType} Expiring`,
        html: expect.stringContaining(complianceData.vesselName),
        priority: 'high',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('generateEmailTemplate', () => {
    it('should generate HTML email template with maritime branding', () => {
      const templateData = {
        title: 'Test Email',
        content: '<p>This is test content</p>',
        actionButton: {
          text: 'View Details',
          url: 'https://flowmarine.com/details',
        },
      };

      const html = emailService.generateEmailTemplate(templateData);

      expect(html).toContain(templateData.title);
      expect(html).toContain(templateData.content);
      expect(html).toContain(templateData.actionButton.text);
      expect(html).toContain(templateData.actionButton.url);
      expect(html).toContain('FlowMarine'); // Branding
    });

    it('should generate template without action button when not provided', () => {
      const templateData = {
        title: 'Simple Email',
        content: '<p>Simple content</p>',
      };

      const html = emailService.generateEmailTemplate(templateData);

      expect(html).toContain(templateData.title);
      expect(html).toContain(templateData.content);
      expect(html).not.toContain('View Details');
    });
  });

  describe('validateEmailConfiguration', () => {
    it('should validate email service configuration', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-message' });

      const isValid = await emailService.validateEmailConfiguration();

      expect(isValid).toBe(true);
    });

    it('should return false for invalid configuration', async () => {
      mockSendMail.mockRejectedValue(new Error('Invalid SMTP configuration'));

      const isValid = await emailService.validateEmailConfiguration();

      expect(isValid).toBe(false);
    });
  });
});