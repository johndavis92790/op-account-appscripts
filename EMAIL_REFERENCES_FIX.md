# Email Account References Fix

## Problem

The "Account ID" column in the **Email Communications** table was storing **Account Names** instead of **Account IDs**, breaking the reference to the Accounts Card Report and causing empty email arrays in Account Data Raw.

**Example:**
- ❌ Stored: "Amica Mutual Insurance" 
- ✅ Should be: "001d000001hUe4KAAS"

## Root Cause

The Email Communications table had 794 emails with Account Names in the "Account ID" column instead of proper Salesforce Account IDs. This prevented the AccountDataRaw.js script from matching emails to accounts.

## Solution Implemented

### 1. **FixEmailAccountReferences.js**
One-time migration script that:
- Converts Account Names to Account IDs in the "Account ID" column
- Preserves Account Names in the "Account Name" column for readability
- Maps 794 existing email records to proper Account IDs

**How to run:**
```
OP Account Tools → 🔧 Data Integrity → Fix Email Account References
```

### 2. **ComprehensiveRemapping.js**
Comprehensive verification and remapping script that:
- Verifies all table references across the entire system
- Fixes broken references automatically where possible
- Identifies orphaned records
- Provides detailed reporting

**Tables verified:**
- Email Communications → Accounts Card Report
- Calendar Events → Accounts Card Report
- GitHub Tasks → Accounts Card Report
- Webhook Meeting Recaps → Accounts Card Report
- Meeting Action Items → Webhook Meeting Recaps
- Accounts Card Report → Opptys Report

**How to run:**
```
OP Account Tools → 🔧 Data Integrity → Comprehensive Table Remapping
```

### 3. **Updated AccountDataRaw.js**
Enhanced email mapping logic with:
- Detection of Account Names vs Account IDs
- Clear warning messages when names are found
- Detailed logging for debugging
- Automatic skipping of invalid references

### 4. **GmailImport.js** (Already Correct)
The Gmail import script was already correctly storing Account IDs. The issue was only with existing historical data.

## Usage Instructions

### First Time Setup (One-Time Migration)

1. **Fix existing email references:**
   ```
   OP Account Tools → 🔧 Data Integrity → Fix Email Account References
   ```
   - This will convert all 794 existing email records
   - Takes ~1-2 minutes
   - Safe to run multiple times (idempotent)

2. **Verify all references:**
   ```
   OP Account Tools → 🔧 Data Integrity → Comprehensive Table Remapping
   ```
   - Verifies and fixes all table relationships
   - Provides detailed report
   - Check logs for any issues

3. **Regenerate Account Data Raw:**
   ```
   OP Account Tools → Account Data Raw → Generate Account Data Raw
   ```
   - The Emails column should now be populated
   - Check logs to confirm emails are being mapped

### Ongoing Maintenance

**New emails imported via GmailImport.js will automatically use correct Account IDs.**

If you ever see empty email arrays in Account Data Raw:
1. Check the logs when generating Account Data Raw
2. Look for warnings about Account Names vs IDs
3. Run "Fix Email Account References" if needed
4. Run "Comprehensive Table Remapping" to verify all references

## Table Relationships Reference

```
Accounts Card Report (Base Table)
├── Id (Primary Key)
└── next_renewal_opportunity_id → Opptys Report.Id

Opptys Report
├── Id (Primary Key)
└── AccountId → Accounts Card Report.Id

Renewal Opportunities
└── Link to SF Opportunity (extracted name) → Opptys Report.Name

Email Communications
├── Message ID (Primary Key)
├── Account ID → Accounts Card Report.Id ✅ FIXED
└── Account Name (for display only)

Calendar Events
├── Event ID (Primary Key)
├── Account ID → Accounts Card Report.Id ✅ CORRECT
└── Meeting Recap ID → Webhook Meeting Recaps.Meeting Recap ID

GitHub Tasks
├── Task ID (Primary Key)
└── Account ID → Accounts Card Report.Id ✅ CORRECT

Webhook Meeting Recaps
├── Meeting Recap ID (Primary Key)
├── Account ID → Accounts Card Report.Id ✅ CORRECT
└── Calendar Event ID → Calendar Events.Event ID

Meeting Action Items
├── Meeting Recap ID + Action Item Index (Composite Key)
├── Meeting Recap ID → Webhook Meeting Recaps.Meeting Recap ID
└── Account Name (denormalized, derived from Meeting Recap)

Accounts to Email Domains Mapping
└── Account ID → Accounts Card Report.Id ✅ CORRECT
```

## Verification

After running the fix, verify:

1. **Email Communications sheet:**
   - "Account ID" column should have IDs like "001d000001hUe4KAAS"
   - "Account Name" column should have names like "Amica Mutual Insurance"

2. **Account Data Raw sheet:**
   - "Emails" column should have JSON arrays of Message IDs
   - Example: `["19be14214b85fc1a", "19bdd27cab4068f7"]`

3. **Logs when generating Account Data Raw:**
   ```
   Built email map with 42 accounts having emails
   Valid emails: 794
   Empty Account IDs: 0
   Skipped (names instead of IDs): 0
   ```

## Troubleshooting

### Issue: Emails column still empty after fix

**Check:**
1. Did you run "Fix Email Account References"?
2. Did you regenerate Account Data Raw after the fix?
3. Check the logs - are there warnings about Account Names?

**Solution:**
```
1. OP Account Tools → 🔧 Data Integrity → Fix Email Account References
2. OP Account Tools → Account Data Raw → Generate Account Data Raw
3. Check logs (View → Logs)
```

### Issue: Some emails couldn't be mapped

**Check the logs for:**
```
⚠️ Could not map account name: "XYZ Company"
```

**This means:**
- The account name in Email Communications doesn't exist in Accounts Card Report
- The account may have been deleted or renamed
- The name might have a typo

**Solution:**
- Manually verify the account exists
- Update the account name if it changed
- Re-run the fix script

### Issue: Orphaned records found

**What are orphaned records?**
Records that reference deleted or non-existent entities.

**Example:**
- Email references Account ID "001ABC" but that account no longer exists

**Solution:**
The Comprehensive Remapping script will identify these. You can:
1. Delete the orphaned records
2. Update them to reference valid accounts
3. Leave them (they'll be ignored by Account Data Raw)

## Files Modified

1. **FixEmailAccountReferences.js** (NEW)
   - One-time migration script

2. **ComprehensiveRemapping.js** (NEW)
   - Comprehensive verification and remapping

3. **AccountDataRaw.js** (UPDATED)
   - Enhanced email mapping with better validation and logging

4. **EmailToSheet.js** (UPDATED)
   - Added menu items for new scripts

5. **GmailImport.js** (NO CHANGES)
   - Already correct, stores Account IDs properly

## Testing

To test the complete solution:

1. **Before fix:**
   ```javascript
   // In Email Communications, Account ID column shows:
   "Amica Mutual Insurance"
   
   // In Account Data Raw, Emails column shows:
   []
   ```

2. **Run fix:**
   ```
   OP Account Tools → 🔧 Data Integrity → Fix Email Account References
   ```

3. **After fix:**
   ```javascript
   // In Email Communications, Account ID column shows:
   "001d000001hUe4KAAS"
   
   // In Account Data Raw, Emails column shows:
   ["19be14214b85fc1a", "19bdd27cab4068f7", ...]
   ```

## Future Improvements

1. **Automated validation on import:**
   - Add validation to GmailImport.js to verify Account IDs are valid
   - Warn if Account ID looks like a name

2. **Scheduled remapping:**
   - Run Comprehensive Remapping on a schedule
   - Alert if issues are found

3. **Data quality dashboard:**
   - Show reference integrity status
   - Highlight broken references
   - Track orphaned records over time
