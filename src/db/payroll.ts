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

export async function upsertOrganization(data: any) {
  try {
    const orgId = data.id || 'org_default';
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
    const result = await withDbRetry(() =>
      db.delete(organizations).where(eq(organizations.id, id)).returning()
    );
    return result[0] || null;
  } catch (error) {
    console.error('Error deleting organization from DB:', error);
    throw new Error('Failed to delete organization.', { cause: error });
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
export async function getEmployees(orgId: string = 'org_default') {
  try {
    return await withDbRetry(() =>
      db.select().from(employees).where(eq(employees.orgId, orgId))
    );
  } catch (error) {
    console.error('Error fetching employees from DB:', error);
    throw new Error('Failed to fetch employees.', { cause: error });
  }
}

export async function upsertEmployee(emp: any, orgId: string = 'org_default') {
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
