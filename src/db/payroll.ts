import { db, withDbRetry } from './index.ts';
import {
  employees,
  organizations,
  salarySetups,
  deductionSetups,
  systemSettings,
  taxReferences,
} from './schema.ts';
import { eq } from 'drizzle-orm';

// Organizations
export async function getOrganizations() {
  try {
    return await withDbRetry(() => db.select().from(organizations));
  } catch (error) {
    console.error('Error fetching organizations from DB:', error);
    throw new Error('Failed to fetch organizations.', { cause: error });
  }
}

export async function getOrganizationById(id: string) {
  try {
    const res = await withDbRetry(() =>
      db.select().from(organizations).where(eq(organizations.id, id))
    );
    return res[0] || null;
  } catch (error) {
    console.error(`Error fetching organization ${id} from DB:`, error);
    throw new Error(`Failed to fetch organization ${id}.`, { cause: error });
  }
}

export async function upsertOrganization(data: any) {
  try {
    if (!data.id) {
      throw new Error('Organization id is required for database operations');
    }
    const orgId = data.id;
    const result = await withDbRetry(() =>
      db
        .insert(organizations)
        .values({
          id: orgId,
          name: data.name || 'नेपाल सरकार',
          officeName: data.officeName || '',
          officeCode: data.officeCode || '',
          ministryName: data.ministryName || '',
          departmentName: data.departmentName || '',
          parentBodyName: data.parentBodyName || '',
          province: data.province || 'बागमती प्रदेश',
          district: data.district || 'काठमाडौं',
          localLevel: data.localLevel || '',
          address: data.address || '',
          email: data.email || '',
          phone: data.phone || '',
          mobile: data.mobile || '',
          whatsapp: data.whatsapp || '',
          website: data.website || '',
          panNumber: data.panNumber || data.pan || '',
          registrationNo: data.registrationNo || '',
          authorizedPersonName: data.authorizedPersonName || '',
          authorizedPersonDesignation: data.authorizedPersonDesignation || '',
          currentFiscalYear: data.currentFiscalYear || '२०८१/८२',
          logoUrl: data.logoUrl || '',
          signatureUrl: data.signatureUrl || '',
          headerText: data.headerText || '',
          footerText: data.footerText || '',
          alignment: data.alignment || 'center',
          spreadsheetId: data.spreadsheetId || null,
          spreadsheetUrl: data.spreadsheetUrl || null,
          driveFolderId: data.driveFolderId || '1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj',
          lastSyncedAt: data.lastSyncedAt ? new Date(data.lastSyncedAt) : null,
          syncStatus: data.syncStatus || 'IDLE',
          createdById: data.createdById || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: organizations.id,
          set: {
            name: data.name,
            officeName: data.officeName,
            officeCode: data.officeCode,
            ministryName: data.ministryName,
            departmentName: data.departmentName,
            parentBodyName: data.parentBodyName,
            province: data.province,
            district: data.district,
            localLevel: data.localLevel,
            address: data.address,
            email: data.email,
            phone: data.phone,
            mobile: data.mobile,
            whatsapp: data.whatsapp,
            website: data.website,
            panNumber: data.panNumber || data.pan,
            registrationNo: data.registrationNo,
            authorizedPersonName: data.authorizedPersonName,
            authorizedPersonDesignation: data.authorizedPersonDesignation,
            currentFiscalYear: data.currentFiscalYear,
            logoUrl: data.logoUrl,
            signatureUrl: data.signatureUrl,
            headerText: data.headerText,
            footerText: data.footerText,
            alignment: data.alignment,
            ...(data.spreadsheetId !== undefined ? { spreadsheetId: data.spreadsheetId } : {}),
            ...(data.spreadsheetUrl !== undefined ? { spreadsheetUrl: data.spreadsheetUrl } : {}),
            ...(data.driveFolderId !== undefined ? { driveFolderId: data.driveFolderId } : {}),
            ...(data.lastSyncedAt !== undefined ? { lastSyncedAt: data.lastSyncedAt ? new Date(data.lastSyncedAt) : null } : {}),
            ...(data.syncStatus !== undefined ? { syncStatus: data.syncStatus } : {}),
            ...(data.createdById !== undefined ? { createdById: data.createdById } : {}),
            updatedAt: new Date(),
          },
        })
        .returning()
    );

    return result[0];
  } catch (error) {
    console.error('Error saving organization to DB:', error);
    throw new Error('Failed to save organization.', { cause: error });
  }
}

export async function deleteOrganizationById(id: string) {
  try {
    try {
      await withDbRetry(() => db.delete(employees).where(eq(employees.orgId, id)));
    } catch {}
    
    const result = await withDbRetry(() =>
      db.delete(organizations).where(eq(organizations.id, id)).returning()
    );
    return result[0] || null;
  } catch (error) {
    console.warn('Notice deleting organization from SQL DB:', error);
    return null;
  }
}

// System Settings
export async function getSystemSetting(key: string) {
  try {
    const result = await withDbRetry(() =>
      db.select().from(systemSettings).where(eq(systemSettings.key, key))
    );
    return result[0] ? result[0].data : null;
  } catch (error) {
    console.error(`Error fetching system setting ${key}:`, error);
    throw new Error(`Failed to fetch setting ${key}.`, { cause: error });
  }
}

export async function setSystemSetting(key: string, data: any, updatedBy?: string) {
  try {
    const result = await withDbRetry(() =>
      db
        .insert(systemSettings)
        .values({
          key,
          data,
          updatedBy: updatedBy || 'system',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            data,
            updatedBy: updatedBy || 'system',
            updatedAt: new Date(),
          },
        })
        .returning()
    );

    return result[0];
  } catch (error) {
    console.error(`Error saving system setting ${key}:`, error);
    throw new Error(`Failed to save setting ${key}.`, { cause: error });
  }
}

// Employees
export async function getEmployees(orgId: string) {
  if (!orgId) throw new Error('orgId is required for all database operations');
  try {
    return await withDbRetry(() =>
      db.select().from(employees).where(eq(employees.orgId, orgId))
    );
  } catch (error) {
    console.error('Error fetching employees from DB:', error);
    throw new Error('Failed to fetch employees.', { cause: error });
  }
}

export async function upsertEmployee(emp: any, orgId: string) {
  if (!orgId) throw new Error('orgId is required for all database operations');
  try {
    const result = await withDbRetry(() =>
      db
        .insert(employees)
        .values({
          id: emp.id,
          orgId,
          code: emp.code,
          name: emp.name,
          designation: emp.designation,
          level: emp.level,
          serviceGroup: emp.serviceGroup || '',
          serviceType: emp.serviceType,
          gender: emp.gender,
          disability: emp.disability,
          remoteArea: emp.remoteArea,
          pension: emp.pension,
          filingType: emp.filingType,
          panNumber: emp.panNumber || '',
          bankAccount: emp.bankAccount || '',
          bankName: emp.bankName || '',
          joinedDateBS: emp.joinedDateBS,
          joinedDateAD: emp.joinedDateAD,
          currentPostDateBS: emp.currentPostDateBS || '',
          currentPostDateAD: emp.currentPostDateAD || '',
          technicalGradeAmount: emp.technicalGradeAmount ? String(emp.technicalGradeAmount) : '0',
          previousGradeCount: emp.previousGradeCount || 0,
          addedGradeCount: emp.addedGradeCount || 0,
          gradeIncreaseMonthText: emp.gradeIncreaseMonthText || '',
          festivalBonusMonth: emp.festivalBonusMonth || '',
          uniformAllowanceMonth: emp.uniformAllowanceMonth || '',
          phone: emp.phone || '',
          email: emp.email || '',
          remarks: emp.remarks || '',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: employees.id,
          set: {
            code: emp.code,
            name: emp.name,
            designation: emp.designation,
            level: emp.level,
            serviceGroup: emp.serviceGroup || '',
            serviceType: emp.serviceType,
            gender: emp.gender,
            disability: emp.disability,
            remoteArea: emp.remoteArea,
            pension: emp.pension,
            filingType: emp.filingType,
            panNumber: emp.panNumber || '',
            bankAccount: emp.bankAccount || '',
            bankName: emp.bankName || '',
            joinedDateBS: emp.joinedDateBS,
            joinedDateAD: emp.joinedDateAD,
            currentPostDateBS: emp.currentPostDateBS || '',
            currentPostDateAD: emp.currentPostDateAD || '',
            technicalGradeAmount: emp.technicalGradeAmount ? String(emp.technicalGradeAmount) : '0',
            previousGradeCount: emp.previousGradeCount || 0,
            addedGradeCount: emp.addedGradeCount || 0,
            gradeIncreaseMonthText: emp.gradeIncreaseMonthText || '',
            festivalBonusMonth: emp.festivalBonusMonth || '',
            uniformAllowanceMonth: emp.uniformAllowanceMonth || '',
            phone: emp.phone || '',
            email: emp.email || '',
            remarks: emp.remarks || '',
            updatedAt: new Date(),
          },
        })
        .returning()
    );

    return result[0];
  } catch (error) {
    console.error('Error upserting employee to DB:', error);
    throw new Error('Failed to upsert employee.', { cause: error });
  }
}

// Organization-scoped Fiscal Year Database (Isolated per office and per FY)
export async function getOrgFyDatabase(orgId: string) {
  if (!orgId) throw new Error('orgId is required');
  try {
    const key = `fy_database_${orgId}`;
    const result = await getSystemSetting(key);
    return result;
  } catch (error) {
    console.error(`Error fetching FY database for org ${orgId}:`, error);
    return null;
  }
}

export async function setOrgFyDatabase(orgId: string, data: any, updatedBy?: string) {
  if (!orgId) throw new Error('orgId is required');
  try {
    const key = `fy_database_${orgId}`;
    return await setSystemSetting(key, data, updatedBy);
  } catch (error) {
    console.error(`Error saving FY database for org ${orgId}:`, error);
    throw error;
  }
}

// Full Organization Isolated Data Store (org, fiscalYears, activeFy, fyDatabase, users, sheetsConfig)
export async function getOrgDataStore(orgId: string) {
  if (!orgId) throw new Error('orgId is required');
  try {
    const key = `org_store_${orgId}`;
    const result = await getSystemSetting(key);
    return result;
  } catch (error) {
    console.error(`Error fetching org data store for ${orgId}:`, error);
    return null;
  }
}

export async function setOrgDataStore(orgId: string, data: any, updatedBy?: string) {
  if (!orgId) throw new Error('orgId is required');
  try {
    const key = `org_store_${orgId}`;
    return await setSystemSetting(key, data, updatedBy);
  } catch (error) {
    console.error(`Error saving org data store for ${orgId}:`, error);
    throw error;
  }
}

