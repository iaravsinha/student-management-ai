export type DepartmentOption = {
  id: string;
  label: string;
  value: string;
  batches: number[];
  semesters: number[];
  subjects: { id: number; name: string }[];
};

export const DEPARTMENT_OPTIONS: DepartmentOption[] = [
  {
    id: "btech-cse",
    label: "B.Tech CSE",
    value: "BTECH CSE",
    batches: [2023, 2024, 2025, 2026],
    semesters: [1, 2, 3, 4, 5, 6, 7, 8],
    subjects: [
      { id: 101, name: "Programming Fundamentals" },
      { id: 102, name: "Data Structures" },
      { id: 103, name: "Database Management Systems" },
      { id: 104, name: "Operating Systems" },
      { id: 105, name: "Computer Networks" },
      { id: 106, name: "Software Engineering" },
    ],
  },
  {
    id: "btech-ece",
    label: "B.Tech ECE",
    value: "BTECH ECE",
    batches: [2023, 2024, 2025, 2026],
    semesters: [1, 2, 3, 4, 5, 6, 7, 8],
    subjects: [
      { id: 201, name: "Circuit Theory" },
      { id: 202, name: "Signals and Systems" },
      { id: 203, name: "Digital Electronics" },
      { id: 204, name: "Microprocessors" },
      { id: 205, name: "Communication Systems" },
    ],
  },
  {
    id: "mba",
    label: "MBA",
    value: "MBA",
    batches: [2023, 2024, 2025, 2026],
    semesters: [1, 2, 3, 4],
    subjects: [
      { id: 301, name: "Management Principles" },
      { id: 302, name: "Financial Accounting" },
      { id: 303, name: "Marketing Management" },
      { id: 304, name: "Business Analytics" },
    ],
  },
] ;

export const getDepartmentConfig = (department?: string | null) =>
  DEPARTMENT_OPTIONS.find((item) => item.value === department) || null;
