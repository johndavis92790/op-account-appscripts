/**
 * Test script for calendar opportunity mapping
 * Run this with: node test-calendar-opportunity.js
 */

// Simulate the improved getEmailDomain function
function getEmailDomain(email) {
  if (!email || typeof email !== 'string') return '';
  
  // Extract email from angle brackets or standalone
  const emailMatch = email.match(/<([^>]+@[^>]+)>|([^\s<>"]+@[^\s<>",]+)/);
  if (!emailMatch) return '';
  
  const emailAddress = emailMatch[1] || emailMatch[2];
  
  // Extract domain, excluding quotes and other special chars
  const domainMatch = emailAddress.match(/@([a-zA-Z0-9.-]+)/);
  
  return domainMatch ? domainMatch[1].toLowerCase().trim() : '';
}

// Simulate mapping data
const mappingData = [
  { opportunity: '2026 - REN - Malwarebytes Inc.', domains: '' },
  { opportunity: '2026 - REN - Torrid', domains: 'torrid.com' },
  { opportunity: '2026 - REN - Accent Group', domains: 'accentgr.com.au' },
  { opportunity: '2026 - REN - ObservePoint Internal', domains: 'observepoint.com' }
];

// Simulate findOpportunityByEmail
function findOpportunityByEmail(email) {
  const domain = getEmailDomain(email);
  if (!domain) return null;
  
  for (let i = 0; i < mappingData.length; i++) {
    const { opportunity, domains } = mappingData[i];
    
    if (domains && typeof domains === 'string') {
      const domainList = domains.split(',').map(d => d.trim().toLowerCase());
      if (domainList.includes(domain)) {
        return opportunity;
      }
    }
  }
  
  return null;
}

// Simulate calendar event with attendees
const testEvents = [
  {
    title: 'Meeting with Accent Group',
    attendees: [
      { email: 'john.davis@observepoint.com', name: 'John Davis' },
      { email: 'stuart.heggie@accentgr.com.au', name: 'Stuart Heggie' },
      { email: 'macey.bell@observepoint.com', name: 'Macey Bell' }
    ]
  },
  {
    title: 'Meeting with Torrid',
    attendees: [
      { email: 'john.davis@observepoint.com', name: 'John Davis' },
      { email: 'contact@torrid.com', name: 'Torrid Contact' }
    ]
  },
  {
    title: 'Internal Meeting',
    attendees: [
      { email: 'john.davis@observepoint.com', name: 'John Davis' },
      { email: 'macey.bell@observepoint.com', name: 'Macey Bell' }
    ]
  },
  {
    title: 'Meeting with Unknown Company',
    attendees: [
      { email: 'john.davis@observepoint.com', name: 'John Davis' },
      { email: 'contact@unknowncompany.com', name: 'Unknown Contact' }
    ]
  }
];

console.log('Testing Calendar Opportunity Mapping:\n');
console.log('Mapping Data:');
mappingData.forEach(m => console.log(`  ${m.opportunity}: ${m.domains || '(empty)'}`));
console.log('\n---\n');

testEvents.forEach((event, index) => {
  console.log(`Test ${index + 1}: ${event.title}`);
  console.log('Attendees:');
  event.attendees.forEach(a => {
    const domain = getEmailDomain(a.email);
    const opp = findOpportunityByEmail(a.email);
    console.log(`  - ${a.email} (${domain}) → ${opp || '(not mapped)'}`);
  });
  
  // Simulate the NEW logic from CalendarImport.js with prioritization
  let opportunity = '';
  const externalAttendees = event.attendees.filter(a => a.email && !a.email.toLowerCase().includes('@observepoint.com'));
  const internalAttendees = event.attendees.filter(a => a.email && a.email.toLowerCase().includes('@observepoint.com'));
  
  // Check external attendees first
  for (const attendee of externalAttendees) {
    opportunity = findOpportunityByEmail(attendee.email);
    if (opportunity) break;
  }
  
  // If no external match, check internal attendees
  if (!opportunity) {
    for (const attendee of internalAttendees) {
      opportunity = findOpportunityByEmail(attendee.email);
      if (opportunity) break;
    }
  }
  
  console.log(`\nEvent Opportunity: ${opportunity || '(not found)'}`);
  console.log('---\n');
});
