/**
 * Calendar Import Configuration
 */

const CALENDAR_CONFIG = {
  calendarId: 'primary',
  
  sheetName: 'Calendar Events',
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
