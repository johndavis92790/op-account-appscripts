/**
 * Test script for opportunity mapping
 * Run this with: node test-opportunity-mapping.js
 */

// Simulate the getEmailDomain function from OpportunityMapping.js
function getEmailDomainOld(email) {
  if (!email || typeof email !== 'string') return '';
  const match = email.match(/@(.+)$/);
  return match ? match[1].toLowerCase() : '';
}

// Simulate the improved getEmailDomain function from GmailImport.js
function getEmailDomainNew(email) {
  if (!email || typeof email !== 'string') return '';
  
  // Extract email from angle brackets or standalone
  const emailMatch = email.match(/<([^>]+@[^>]+)>|([^\s<>"]+@[^\s<>",]+)/);
  if (!emailMatch) return '';
  
  const emailAddress = emailMatch[1] || emailMatch[2];
  
  // Extract domain, excluding quotes and other special chars
  const domainMatch = emailAddress.match(/@([a-zA-Z0-9.-]+)/);
  
  return domainMatch ? domainMatch[1].toLowerCase().trim() : '';
}

// Simulate mapping data from screenshot
const mappingData = [
  { opportunity: '2026 - REN - Malwarebytes Inc.', domains: '' },
  { opportunity: '2026 - REN - Torrid', domains: 'torrid.com' },
  { opportunity: '2026 - REN - Accent Group', domains: 'accentgr.com.au' }
];

// Simulate findOpportunityByEmail using OLD getEmailDomain
function findOpportunityByEmailOld(email) {
  const domain = getEmailDomainOld(email);
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

// Simulate findOpportunityByEmail using NEW getEmailDomain
function findOpportunityByEmailNew(email) {
  const domain = getEmailDomainNew(email);
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

// Simulate the new logic that checks all emails in comma-separated list
function findOpportunityFromMultipleEmails(emailString) {
  // Try from field (single email)
  let opportunity = findOpportunityByEmailNew(emailString);
  if (opportunity) return opportunity;
  
  // Try splitting and checking each email
  const emails = emailString.split(',').map(e => e.trim());
  for (const email of emails) {
    opportunity = findOpportunityByEmailNew(email);
    if (opportunity) return opportunity;
  }
  
  return null;
}

// Test with the actual email from screenshot
const testEmails = [
  '"nic.suder@observepoint.com" <nic.suder@observepoint.com>, "stuart.heggie@accentgr.com.au" <stuart.heggie@accentgr.com.au>, "john.davis@observepoint.com" <john.davis@observepoint.com>, "todd.wilkerson@observepoint.com" <todd.wilkerson@observepoint.com>',
  'stuart.heggie@accentgr.com.au',
  '"stuart.heggie@accentgr.com.au" <stuart.heggie@accentgr.com.au>',
  'someone@torrid.com'
];

console.log('Testing Opportunity Mapping:\n');
console.log('Mapping Data:');
mappingData.forEach(m => console.log(`  ${m.opportunity}: ${m.domains || '(empty)'}`));
console.log('\n---\n');

testEmails.forEach((email, index) => {
  console.log(`Test ${index + 1}:`);
  console.log(`Email: "${email}"`);
  console.log(`Domain (OLD): "${getEmailDomainOld(email)}"`);
  console.log(`Domain (NEW): "${getEmailDomainNew(email)}"`);
  console.log(`Opportunity (OLD): ${findOpportunityByEmailOld(email) || '(not found)'}`);
  console.log(`Opportunity (NEW single): ${findOpportunityByEmailNew(email) || '(not found)'}`);
  console.log(`Opportunity (NEW multi): ${findOpportunityFromMultipleEmails(email) || '(not found)'}`);
  console.log('---\n');
});

// Test extracting individual emails from comma-separated list
console.log('\nTesting individual email extraction from comma-separated list:\n');
const multiEmailString = '"nic.suder@observepoint.com" <nic.suder@observepoint.com>, "stuart.heggie@accentgr.com.au" <stuart.heggie@accentgr.com.au>, "john.davis@observepoint.com" <john.davis@observepoint.com>';

const emails = multiEmailString.split(',').map(e => e.trim());
console.log('Individual emails:');
emails.forEach((email, i) => {
  const domain = getEmailDomainNew(email);
  const opp = findOpportunityByEmailNew(email);
  console.log(`  ${i + 1}. "${email}"`);
  console.log(`     Domain: ${domain}`);
  console.log(`     Opportunity: ${opp || '(not found)'}`);
});
