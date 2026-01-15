/**
 * Manual Import Function - For UI-triggered imports
 * Includes user alerts and feedback
 * @param {string} configId - Optional config ID to import specific CSV
 */
function importLatestCSVManual(configId) {
  const startTime = new Date();
  Logger.log('=== Starting Manual CSV Import from Email ===');
  
  try {
    const result = importLatestCSV(configId);
    
    SpreadsheetApp.getUi().alert(
      'Import Complete',
      `✅ ${result.configName}\n\nImported ${result.rowCount} rows.\nDuration: ${result.duration}s`,
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
 * Manual import all CSVs with UI feedback
 */
function importAllCSVsManual() {
  const startTime = new Date();
  Logger.log('=== Starting Manual Import of All CSVs ===');
  
  try {
    const results = importAllCSVs();
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    let message = `Imported ${successCount}/${results.length} CSV files\n\n`;
    
    results.forEach(result => {
      if (result.success) {
        message += `✅ ${result.configName}: ${result.rowCount} rows\n`;
      } else {
        message += `❌ ${result.configName}: ${result.error}\n`;
      }
    });
    
    const duration = (new Date() - startTime) / 1000;
    message += `\nTotal duration: ${duration}s`;
    
    SpreadsheetApp.getUi().alert(
      'Import All Complete',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    
    SpreadsheetApp.getUi().alert(
      'Import All Failed',
      'Error: ' + error.message + '\n\nCheck the logs for details.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
