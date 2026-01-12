/**
 * Test script for domain extraction
 * Run this with: node test-domain-extraction.js
 */

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

// Test cases from the screenshots
const testCases = [
  // From column examples
  'Revenue Operations <salesops@observepoint.com>',
  '"IALONGO, FRANCESCO S." <FIALONGO@amica.com>',
  
  // To column examples
  '"nic.suder@observepoint.com" <nic.suder@observepoint.com>, "stuart.heggie@accentgr.com.au" <stuart.heggie@accentgr.com.au>, "john.davis@observepoint.com" <john.davis@observepoint.com>, "todd.wilkerson@observepoint.com" <todd.wilkerson@observepoint.com>',
  'John Davis <john.davis@observepoint.com>',
  'John Davis <john.davis@observepoint.com>, Macey Bell <macey.bell@observepoint.com>',
  
  // CC column examples
  'Macey Bell <macey.bell@observepoint.com>, Dallin Madsen <dallin.madsen@observepoint.com>',
  'john.davis@observepoint.com',
  
  // Edge cases
  'simple@domain.com',
  '"Name with spaces" <email@domain.com>',
  'Name <email@domain.com>',
];

console.log('Testing getEmailDomain function:\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}:`);
  console.log(`Input:  "${testCase}"`);
  console.log(`Output: "${getEmailDomain(testCase)}"`);
  console.log('---');
});

// Test extracting multiple domains from comma-separated list
console.log('\n\nTesting multiple email extraction:\n');

const multipleEmails = '"nic.suder@observepoint.com" <nic.suder@observepoint.com>, "stuart.heggie@accentgr.com.au" <stuart.heggie@accentgr.com.au>, "john.davis@observepoint.com" <john.davis@observepoint.com>';

console.log('Input:', multipleEmails);
const domains = multipleEmails.split(',').map(e => getEmailDomain(e.trim())).filter(d => d).join(', ');
console.log('Output:', domains);
console.log('Expected: observepoint.com, accentgr.com.au, observepoint.com');
