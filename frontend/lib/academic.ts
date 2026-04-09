import { DepartmentSummary } from "./types";

export type DepartmentCatalog = {
  id: number;
  name: string;
  code: string;
  batches: number[];
  semesters: number[];
  batchStartYear: number;
  batchEndYear: number;
  semesterCount: number;
};

const sortNumbers = (values: number[]) => [...values].sort((left, right) => left - right);

export const buildDepartmentCatalog = (departments: DepartmentSummary[]): DepartmentCatalog[] =>
  departments
    .map((department) => ({
      id: department.id,
      name: department.name,
      code: department.code,
      batchStartYear: department.batch_start_year,
      batchEndYear: department.batch_end_year,
      semesterCount: department.semester_count,
      batches: sortNumbers(department.active_batches),
      semesters: sortNumbers(department.active_semesters),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

export const getDepartmentOption = (catalog: DepartmentCatalog[], departmentName?: string | null) =>
  catalog.find((item) => item.name === departmentName) || null;

export const getFallbackDepartmentOption = (catalog: DepartmentCatalog[]) => catalog[0] || null;
