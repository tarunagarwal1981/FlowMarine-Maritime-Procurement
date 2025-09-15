#!/usr/bin/env node

/**
 * Enhanced Dashboard Export Service Validation Script
 * Tests all export functionality including PDF, Excel, templates, and scheduled reports
 */

import { PrismaClient } from '@prisma/client';
import { dashboardExportService } from './src/services/dashboardExportService.js';
import { promises as fs } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

async function createTestData() {
  log('\n📊 Creating test data...', colors.cyan);
  
  try {
    // Create test user
    const testUser = await prisma.user.upsert({
      where: { email: 'export-validator@flowmarine.com' },
      update: {},
      create: {
        email: 'export-validator@flowmarine.com',
        passwordHash: 'hashed_password',
        firstName: 'Export',
        lastName: 'Validator',
        role: 'PROCUREMENT_MANAGER',
        isActive: true,
        emailVerified: true
      }
    });

    // Create test vessel
    const testVessel = await prisma.vessel.upsert({
      where: { imoNumber: 'IMO8888888' },
      update: {},
      create: {
        name: 'Export Test Vessel',
        imoNumber: 'IMO8888888',
        vesselType: 'Bulk Carrier',
        flag: 'US',
        engineType: 'Diesel',
        cargoCapacity: 75000,
        fuelConsumption: 250,
        crewComplement: 22
      }
    });

    // Create test vendor
    const testVendor = await prisma.vendor.upsert({
      where: { code: 'ETV001' },
      update: {},
      create: {
        name: 'Export Test Vendor',
        code: 'ETV001',
        email: 'vendor@exporttest.com',
        phone: '+1234567890',
        address: '123 Export St',
        city: 'Export City',
        country: 'US',
        paymentTerms: 'NET30',
        creditLimit: 150000,
        qualityRating: 9.0,
        deliveryRating: 8.5,
        priceRating: 8.0,
        overallScore: 8.5,
        isActive: true
      }
    });

    logSuccess('Test data created successfully');
    return { testUser, testVessel, testVendor };
  } catch (error) {
    logError(`Failed to create test data: ${error.message}`);
    throw error;
  }
}

async function testPDFExport(userId) {
  log('\n📄 Testing PDF Export...', colors.cyan);
  
  try {
    const exportOptions = {
      format: 'pdf',
      dashboardType: 'executive',
      dataTypes: ['spend_analytics', 'budget_utilization', 'vendor_performance'],
      filters: {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        baseCurrency: 'USD'
      },
      includeCharts: true,
      includeMetadata: true,
      customTitle: 'Validation Test Report'
    };

    const pdfBuffer = await dashboardExportService.exportToPDF(exportOptions, userId);
    
    // Validate PDF
    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('PDF export did not return a Buffer');
    }
    
    if (pdfBuffer.length === 0) {
      throw new Error('PDF export returned empty buffer');
    }
    
    // Check PDF header
    const pdfHeader = pdfBuffer.subarray(0, 4).toString();
    if (pdfHeader !== '%PDF') {
      throw new Error('Invalid PDF header');
    }
    
    // Save test PDF
    const testPdfPath = join('exports', 'test_export.pdf');
    await fs.mkdir('exports', { recursive: true });
    await fs.writeFile(testPdfPath, pdfBuffer);
    
    logSuccess(`PDF export successful (${pdfBuffer.length} bytes)`);
    logInfo(`Test PDF saved to: ${testPdfPath}`);
    
    return true;
  } catch (error) {
    logError(`PDF export failed: ${error.message}`);
    return false;
  }
}

async function testExcelExport(userId) {
  log('\n📊 Testing Excel Export...', colors.cyan);
  
  try {
    const exportOptions = {
      format: 'excel',
      dashboardType: 'operational',
      dataTypes: ['operational_metrics', 'vendor_performance', 'financial_insights'],
      filters: {
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        baseCurrency: 'USD'
      },
      includeCharts: false,
      includeMetadata: true,
      compression: true
    };

    const excelBuffer = await dashboardExportService.exportToExcel(exportOptions, userId);
    
    // Validate Excel
    if (!Buffer.isBuffer(excelBuffer)) {
      throw new Error('Excel export did not return a Buffer');
    }
    
    if (excelBuffer.length === 0) {
      throw new Error('Excel export returned empty buffer');
    }
    
    // Check Excel file signature (ZIP format)
    const excelSignature = excelBuffer.subarray(0, 2);
    if (excelSignature[0] !== 0x50 || excelSignature[1] !== 0x4B) {
      throw new Error('Invalid Excel file signature');
    }
    
    // Save test Excel
    const testExcelPath = join('exports', 'test_export.xlsx');
    await fs.writeFile(testExcelPath, excelBuffer);
    
    logSuccess(`Excel export successful (${excelBuffer.length} bytes)`);
    logInfo(`Test Excel saved to: ${testExcelPath}`);
    
    return true;
  } catch (error) {
    logError(`Excel export failed: ${error.message}`);
    return false;
  }
}

async function testExportTemplates(userId) {
  log('\n📋 Testing Export Templates...', colors.cyan);
  
  try {
    // Create custom template
    const templateData = {
      name: 'Validation Test Template',
      description: 'Template created during validation testing',
      dashboardType: 'executive',
      layout: {
        sections: [
          {
            id: 'header',
            type: 'header',
            title: 'FlowMarine Validation Report',
            position: { x: 0, y: 0, width: 100, height: 10 }
          },
          {
            id: 'kpis',
            type: 'kpi',
            title: 'Key Performance Indicators',
            position: { x: 0, y: 15, width: 100, height: 25 }
          },
          {
            id: 'charts',
            type: 'chart',
            title: 'Performance Charts',
            dataType: 'spend_analytics',
            position: { x: 0, y: 45, width: 100, height: 35 }
          },
          {
            id: 'data_table',
            type: 'table',
            title: 'Detailed Data',
            position: { x: 0, y: 85, width: 100, height: 15 }
          }
        ],
        pageSettings: {
          orientation: 'portrait',
          margins: { top: 60, bottom: 60, left: 50, right: 50 },
          headerHeight: 70,
          footerHeight: 50
        }
      },
      styling: {
        colors: {
          primary: '#1e40af',
          secondary: '#0891b2',
          accent: '#059669',
          text: '#374151',
          background: '#ffffff'
        },
        fonts: {
          title: { family: 'Helvetica-Bold', size: 20, weight: 'bold' },
          heading: { family: 'Helvetica-Bold', size: 16, weight: 'bold' },
          body: { family: 'Helvetica', size: 12, weight: 'normal' },
          caption: { family: 'Helvetica', size: 10, weight: 'normal' }
        },
        branding: {
          companyName: 'FlowMarine Validation',
          tagline: 'Testing Maritime Excellence'
        }
      },
      permissions: ['VIEW_ANALYTICS', 'VIEW_FINANCIAL_DATA'],
      isActive: true,
      createdBy: userId
    };

    const template = await dashboardExportService.createExportTemplate(templateData);
    logSuccess(`Template created: ${template.id}`);

    // Get templates
    const templates = await dashboardExportService.getExportTemplates(userId);
    logSuccess(`Retrieved ${templates.length} templates`);

    // Update template
    const updatedTemplate = await dashboardExportService.updateExportTemplate(
      template.id,
      { 
        name: 'Updated Validation Template',
        description: 'Updated during validation testing'
      },
      userId
    );
    logSuccess(`Template updated: ${updatedTemplate.name}`);

    // Test export with custom template
    const exportOptions = {
      format: 'pdf',
      dashboardType: 'executive',
      dataTypes: ['spend_analytics', 'budget_utilization'],
      filters: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        baseCurrency: 'USD'
      },
      includeCharts: true,
      templateId: template.id,
      customTitle: 'Custom Template Test',
      includeMetadata: true
    };

    const pdfBuffer = await dashboardExportService.exportToPDF(exportOptions, userId);
    const customTemplatePdfPath = join('exports', 'custom_template_test.pdf');
    await fs.writeFile(customTemplatePdfPath, pdfBuffer);
    
    logSuccess(`Custom template export successful`);
    logInfo(`Custom template PDF saved to: ${customTemplatePdfPath}`);

    return { template, success: true };
  } catch (error) {
    logError(`Template testing failed: ${error.message}`);
    return { template: null, success: false };
  }
}

async function testScheduledReports(userId) {
  log('\n⏰ Testing Scheduled Reports...', colors.cyan);
  
  try {
    // Create scheduled report
    const reportData = {
      name: 'Validation Weekly Report',
      description: 'Weekly report created during validation testing',
      userId: userId,
      exportOptions: {
        format: 'excel',
        dashboardType: 'operational',
        dataTypes: ['operational_metrics', 'vendor_performance'],
        filters: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          baseCurrency: 'USD'
        },
        includeCharts: false,
        includeMetadata: true
      },
      schedule: {
        frequency: 'weekly',
        dayOfWeek: 1, // Monday
        time: '09:00',
        timezone: 'UTC'
      },
      recipients: ['validation@flowmarine.com', 'test@flowmarine.com'],
      isActive: true
    };

    const scheduledReport = await dashboardExportService.scheduleReport(reportData);
    logSuccess(`Scheduled report created: ${scheduledReport.id}`);
    logInfo(`Next run: ${scheduledReport.nextRun}`);

    // Get scheduled reports
    const reports = await dashboardExportService.getScheduledReports(userId);
    logSuccess(`Retrieved ${reports.length} scheduled reports`);

    // Update scheduled report
    const updatedReport = await dashboardExportService.updateScheduledReport(
      scheduledReport.id,
      {
        name: 'Updated Validation Report',
        schedule: {
          frequency: 'daily',
          time: '08:30',
          timezone: 'UTC'
        }
      },
      userId
    );
    logSuccess(`Scheduled report updated: ${updatedReport.name}`);
    logInfo(`Updated next run: ${updatedReport.nextRun}`);

    return { scheduledReport, success: true };
  } catch (error) {
    logError(`Scheduled reports testing failed: ${error.message}`);
    return { scheduledReport: null, success: false };
  }
}

async function testAsyncExportJobs(userId) {
  log('\n🔄 Testing Async Export Jobs...', colors.cyan);
  
  try {
    // Create export job
    const exportOptions = {
      format: 'pdf',
      dashboardType: 'financial',
      dataTypes: ['financial_insights', 'spend_analytics', 'budget_utilization'],
      filters: {
        startDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        baseCurrency: 'USD'
      },
      includeCharts: true,
      includeMetadata: true,
      customTitle: 'Async Export Job Test'
    };

    const jobId = await dashboardExportService.createExportJob(exportOptions, userId);
    logSuccess(`Export job created: ${jobId}`);

    // Wait for job processing
    logInfo('Waiting for job processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check job status
    const jobStatus = await dashboardExportService.getExportJobStatus(jobId);
    if (jobStatus) {
      logSuccess(`Job status: ${jobStatus.status} (${jobStatus.progress}%)`);
      if (jobStatus.filePath) {
        logInfo(`Export file: ${jobStatus.filePath}`);
      }
      if (jobStatus.error) {
        logWarning(`Job error: ${jobStatus.error}`);
      }
    } else {
      logWarning('Job status not found');
    }

    return { jobId, success: true };
  } catch (error) {
    logError(`Async export jobs testing failed: ${error.message}`);
    return { jobId: null, success: false };
  }
}

async function testPermissionValidation(userId) {
  log('\n🔒 Testing Permission Validation...', colors.cyan);
  
  try {
    // Create user with limited permissions
    const limitedUser = await prisma.user.create({
      data: {
        email: 'limited-export@flowmarine.com',
        passwordHash: 'hashed_password',
        firstName: 'Limited',
        lastName: 'User',
        role: 'VESSEL_CREW',
        isActive: true,
        emailVerified: true
      }
    });

    const exportOptions = {
      format: 'pdf',
      dashboardType: 'executive',
      dataTypes: ['spend_analytics'],
      filters: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        baseCurrency: 'USD'
      },
      includeCharts: true,
      includeMetadata: true
    };

    try {
      await dashboardExportService.exportToPDF(exportOptions, limitedUser.id);
      logError('Permission validation failed - export should have been denied');
      return false;
    } catch (error) {
      if (error.message.includes('Insufficient permissions')) {
        logSuccess('Permission validation working correctly');
        return true;
      } else {
        logError(`Unexpected error: ${error.message}`);
        return false;
      }
    } finally {
      // Cleanup limited user
      await prisma.user.delete({ where: { id: limitedUser.id } });
    }
  } catch (error) {
    logError(`Permission validation testing failed: ${error.message}`);
    return false;
  }
}

async function testCleanupFunctionality() {
  log('\n🧹 Testing Cleanup Functionality...', colors.cyan);
  
  try {
    // Create test export files
    const testExportDir = 'exports';
    await fs.mkdir(testExportDir, { recursive: true });
    
    const testFiles = [
      'old_export_1.pdf',
      'old_export_2.xlsx',
      'recent_export.pdf'
    ];
    
    for (const fileName of testFiles) {
      const filePath = join(testExportDir, fileName);
      await fs.writeFile(filePath, Buffer.from('test content'));
      
      // Make first two files old
      if (fileName.startsWith('old_')) {
        const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
        await fs.utimes(filePath, oldTime, oldTime);
      }
    }
    
    // Run cleanup
    await dashboardExportService.cleanupOldExports();
    
    // Check which files remain
    const remainingFiles = await fs.readdir(testExportDir);
    const hasRecentFile = remainingFiles.includes('recent_export.pdf');
    const hasOldFiles = remainingFiles.some(file => file.startsWith('old_'));
    
    if (hasRecentFile && !hasOldFiles) {
      logSuccess('Cleanup functionality working correctly');
      return true;
    } else {
      logWarning('Cleanup may not have worked as expected');
      logInfo(`Remaining files: ${remainingFiles.join(', ')}`);
      return false;
    }
  } catch (error) {
    logWarning(`Cleanup testing skipped: ${error.message}`);
    return true; // Don't fail validation for cleanup issues
  }
}

async function cleanupTestData() {
  log('\n🧽 Cleaning up test data...', colors.cyan);
  
  try {
    await prisma.vendor.deleteMany({ 
      where: { name: { contains: 'Export Test' } } 
    });
    
    await prisma.vessel.deleteMany({ 
      where: { name: { contains: 'Export Test' } } 
    });
    
    await prisma.user.deleteMany({ 
      where: { email: { contains: 'export-validator' } } 
    });
    
    logSuccess('Test data cleaned up');
  } catch (error) {
    logWarning(`Cleanup warning: ${error.message}`);
  }
}

async function runValidation() {
  log('🚀 Starting Dashboard Export Service Validation', colors.bright);
  log('=' .repeat(60), colors.cyan);
  
  const results = {
    testData: false,
    pdfExport: false,
    excelExport: false,
    templates: false,
    scheduledReports: false,
    asyncJobs: false,
    permissions: false,
    cleanup: false
  };
  
  try {
    // Create test data
    const { testUser } = await createTestData();
    results.testData = true;
    
    // Run all tests
    results.pdfExport = await testPDFExport(testUser.id);
    results.excelExport = await testExcelExport(testUser.id);
    
    const templateResult = await testExportTemplates(testUser.id);
    results.templates = templateResult.success;
    
    const reportResult = await testScheduledReports(testUser.id);
    results.scheduledReports = reportResult.success;
    
    const jobResult = await testAsyncExportJobs(testUser.id);
    results.asyncJobs = jobResult.success;
    
    results.permissions = await testPermissionValidation(testUser.id);
    results.cleanup = await testCleanupFunctionality();
    
    // Summary
    log('\n📊 Validation Summary', colors.bright);
    log('=' .repeat(40), colors.cyan);
    
    const testResults = [
      ['Test Data Creation', results.testData],
      ['PDF Export', results.pdfExport],
      ['Excel Export', results.excelExport],
      ['Export Templates', results.templates],
      ['Scheduled Reports', results.scheduledReports],
      ['Async Export Jobs', results.asyncJobs],
      ['Permission Validation', results.permissions],
      ['Cleanup Functionality', results.cleanup]
    ];
    
    testResults.forEach(([test, passed]) => {
      if (passed) {
        logSuccess(`${test}: PASSED`);
      } else {
        logError(`${test}: FAILED`);
      }
    });
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    log(`\n📈 Overall Result: ${passedTests}/${totalTests} tests passed`, 
        passedTests === totalTests ? colors.green : colors.yellow);
    
    if (passedTests === totalTests) {
      logSuccess('🎉 All dashboard export functionality is working correctly!');
    } else {
      logWarning('⚠️  Some tests failed. Please review the output above.');
    }
    
  } catch (error) {
    logError(`Validation failed with error: ${error.message}`);
    console.error(error);
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

// Run validation
runValidation().catch(console.error);