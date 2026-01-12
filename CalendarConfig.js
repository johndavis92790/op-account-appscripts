/**
 * Calendar Import Configuration
 */

const CALENDAR_CONFIG = {
  calendarId: 'primary',
  
  sheetName: 'Calendar Events',
  
  excludedTitles: [
    'CEO Update ObservePoint',
    'ObservePoint Company Lunch',
    'OP Pickleball Club',
    'John Pestana\'s birthday',
    'CS Team Sync',
    'Customer Success | QBR',
    'Out of office',
    'Home',
    'Pleasant Grove Suite 300 (Office)',
    'Time Allocations'
  ]
};

function getCalendarImportConfig() {
  const props = PropertiesService.getScriptProperties();
  
  if (props.getProperty('CALENDAR_ID')) {
    CALENDAR_CONFIG.calendarId = props.getProperty('CALENDAR_ID');
  }
  if (props.getProperty('CALENDAR_SHEET_NAME')) {
    CALENDAR_CONFIG.sheetName = props.getProperty('CALENDAR_SHEET_NAME');
  }
  
  return CALENDAR_CONFIG;
}
