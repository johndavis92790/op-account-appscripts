/**
 * Email to Sheet - Simple CSV Import from Gmail
 * 
 * Automatically imports CSV attachments from scheduled emails into Google Sheets
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Email Import')
    .addItem('Import Latest CSV', 'importLatestCSV')
    .addItem('Setup Auto-Import', 'setupAutoImport')
    .addItem('Test Email Search', 'testEmailSearch')
    .addToUi();
  
  ui.createMenu('Calendar Import')
    .addItem('Import Calendar Events', 'importCalendarEvents')
    .addItem('Setup Auto-Import (15 min)', 'setupCalendarAutoImport')
    .addItem('Test Calendar Import', 'testCalendarImport')
    .addToUi();
}

/**
 * Main function - Import latest CSV from email
 */
function importLatestCSV() {
  const startTime = new Date();
  Logger.log('=== Starting CSV Import from Email ===');
  
  try {
    const config = getEmailConfig();
    
    Logger.log('Step 1: Searching for emails...');
    const csvData = findAndExtractLatestCSV(config);
    
    if (!csvData) {
      throw new Error('No CSV attachment found in recent emails');
    }
    
    Logger.log('Step 2: Parsing CSV data...');
    const parsedData = parseCSV(csvData);
    Logger.log(`Parsed ${parsedData.length} rows`);
    
    Logger.log('Step 3: Writing to sheet...');
    writeToSheet(parsedData, config.sheetName);
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Import Complete in ${duration}s ===`);
    
    SpreadsheetApp.getUi().alert(
      'Import Complete',
      `Successfully imported ${parsedData.length} rows from CSV.\n\nDuration: ${duration}s`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    
    SpreadsheetApp.getUi().alert(
      'Import Failed',
      'Error: ' + error.message + '\n\nCheck the logs for details.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Find and extract the latest CSV attachment from Gmail
 */
function findAndExtractLatestCSV(config) {
  const searchQuery = config.emailSearchQuery;
  const threads = GmailApp.search(searchQuery, 0, 10);
  
  Logger.log(`Found ${threads.length} email threads matching: "${searchQuery}"`);
  
  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    
    for (let j = messages.length - 1; j >= 0; j--) {
      const message = messages[j];
      const attachments = message.getAttachments();
      
      Logger.log(`Checking message from ${message.getDate()}: ${attachments.length} attachments`);
      
      for (let k = 0; k < attachments.length; k++) {
        const attachment = attachments[k];
        const fileName = attachment.getName();
        
        if (fileName.toLowerCase().endsWith('.csv')) {
          Logger.log(`Found CSV: ${fileName}`);
          const csvContent = attachment.getDataAsString();
          
          if (config.markAsRead) {
            message.markRead();
          }
          
          return csvContent;
        }
      }
    }
  }
  
  return null;
}

/**
 * Parse CSV content into array of arrays
 */
function parseCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/);
  const result = [];
  let healthColumnIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    
    const row = parseCSVLine(line);
    
    if (i === 0) {
      healthColumnIndex = row.indexOf('Health');
    }
    
    if (healthColumnIndex !== -1) {
      row.splice(healthColumnIndex, 1);
    }
    
    result.push(row);
  }
  
  return result;
}

/**
 * Parse a single CSV line (handles quoted fields)
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : null;
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Parse HTML link and extract text and URL
 */
function parseHTMLLink(htmlString) {
  const hrefMatch = htmlString.match(/href="([^"]+)"/);
  const textMatch = htmlString.match(/>([^<]+)<\/a>/);
  
  if (hrefMatch && textMatch) {
    return {
      url: hrefMatch[1],
      text: textMatch[1]
    };
  }
  
  return null;
}

/**
 * Process data to convert HTML links to Google Sheets formulas
 */
function processDataForSheet(data) {
  if (data.length === 0) return data;
  
  const headers = data[0];
  const linkColumnIndex = headers.indexOf('Link to SF Opportunity');
  const renewalDateIndex = headers.indexOf('Renewal Date');
  const renewableIndex = headers.indexOf('Renewable');
  const forcastIndex = headers.indexOf('Forcast');
  const amountIndex = headers.indexOf('Amount (gross)');
  
  const processedData = data.map((row, rowIndex) => {
    if (rowIndex === 0) return row;
    
    const newRow = [...row];
    
    if (linkColumnIndex !== -1) {
      const cellValue = row[linkColumnIndex];
      if (cellValue && cellValue.includes('<a href')) {
        const parsed = parseHTMLLink(cellValue);
        if (parsed) {
          newRow[linkColumnIndex] = `=HYPERLINK("${parsed.url}", "${parsed.text}")`;
        }
      }
    }
    
    if (renewalDateIndex !== -1) {
      const dateValue = row[renewalDateIndex];
      if (dateValue) {
        const dateMatch = dateValue.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          newRow[renewalDateIndex] = dateMatch[1];
        }
      }
    }
    
    if (renewableIndex !== -1 && row[renewableIndex]) {
      newRow[renewableIndex] = parseFloat(row[renewableIndex]) || row[renewableIndex];
    }
    
    if (forcastIndex !== -1 && row[forcastIndex]) {
      newRow[forcastIndex] = parseFloat(row[forcastIndex]) || row[forcastIndex];
    }
    
    if (amountIndex !== -1 && row[amountIndex]) {
      newRow[amountIndex] = parseFloat(row[amountIndex]) || row[amountIndex];
    }
    
    return newRow;
  });
  
  return processedData;
}

/**
 * Write data to Google Sheet
 */
function writeToSheet(data, sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  
  sheet.clear();
  
  const processedData = processDataForSheet(data);
  
  if (data.length > 0) {
    
    const headers = processedData[0];
    const linkColumnIndex = headers.indexOf('Link to SF Opportunity');
    
    for (let i = 0; i < processedData.length; i++) {
      for (let j = 0; j < processedData[i].length; j++) {
        const cellValue = processedData[i][j];
        const cell = sheet.getRange(i + 1, j + 1);
        
        if (i > 0 && j === linkColumnIndex && cellValue && cellValue.startsWith('=HYPERLINK')) {
          cell.setFormula(cellValue);
        } else {
          cell.setValue(cellValue);
        }
      }
    }
    
    sheet.getRange(1, 1, 1, processedData[0].length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
    
    for (let i = 1; i <= processedData[0].length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    sheet.setFrozenRows(1);
    
    const renewableIndex = headers.indexOf('Renewable');
    const forcastIndex = headers.indexOf('Forcast');
    const amountIndex = headers.indexOf('Amount (gross)');
    const auditUsageIndex = headers.indexOf('Audit Usage');
    const journeyUsageIndex = headers.indexOf('Journey Usage');
    
    if (processedData.length > 1) {
      if (renewableIndex !== -1) {
        sheet.getRange(2, renewableIndex + 1, processedData.length - 1, 1)
          .setNumberFormat('$#,##0.00');
      }
      if (forcastIndex !== -1) {
        sheet.getRange(2, forcastIndex + 1, processedData.length - 1, 1)
          .setNumberFormat('$#,##0.00');
      }
      if (amountIndex !== -1) {
        sheet.getRange(2, amountIndex + 1, processedData.length - 1, 1)
          .setNumberFormat('$#,##0.00');
      }
      if (auditUsageIndex !== -1) {
        sheet.getRange(2, auditUsageIndex + 1, processedData.length - 1, 1)
          .setNumberFormat('0.00%');
      }
      if (journeyUsageIndex !== -1) {
        sheet.getRange(2, journeyUsageIndex + 1, processedData.length - 1, 1)
          .setNumberFormat('0.00%');
      }
    }
  }
  
  const timestamp = new Date();
  sheet.getRange(1, processedData[0].length + 2).setValue('Last Updated:');
  sheet.getRange(1, processedData[0].length + 3).setValue(timestamp);
  
  Logger.log(`Wrote ${data.length} rows to sheet "${sheetName}"`);
}

/**
 * Test email search to verify configuration
 */
function testEmailSearch() {
  try {
    const config = getEmailConfig();
    const searchQuery = config.emailSearchQuery;
    
    Logger.log(`Testing search query: "${searchQuery}"`);
    const threads = GmailApp.search(searchQuery, 0, 5);
    
    Logger.log(`Found ${threads.length} threads`);
    
    let message = `Search Query: ${searchQuery}\n\nFound ${threads.length} email thread(s):\n\n`;
    
    threads.forEach((thread, i) => {
      const firstMessage = thread.getMessages()[0];
      const attachments = firstMessage.getAttachments();
      const csvCount = attachments.filter(a => a.getName().toLowerCase().endsWith('.csv')).length;
      
      message += `${i + 1}. ${firstMessage.getSubject()}\n`;
      message += `   Date: ${firstMessage.getDate()}\n`;
      message += `   CSV Attachments: ${csvCount}\n\n`;
    });
    
    SpreadsheetApp.getUi().alert('Email Search Test', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    Logger.log('Test failed: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Test Failed',
      'Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Setup automatic import trigger
 */
function setupAutoImport() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'importLatestCSV') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('importLatestCSV')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .inTimezone('America/Denver')
    .create();
  
  Logger.log('Auto-import trigger created (runs daily at 2am MST)');
  
  SpreadsheetApp.getUi().alert(
    'Auto-Import Enabled',
    'CSV will now be imported automatically every day at 2am MST.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
