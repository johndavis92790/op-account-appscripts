/**
 * Manual Import Function - For UI-triggered imports
 * Includes user alerts and feedback
 */

function importLatestCSVManual() {
  const startTime = new Date();
  Logger.log('=== Starting Manual CSV Import from Email ===');
  
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
