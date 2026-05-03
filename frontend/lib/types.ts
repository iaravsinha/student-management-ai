export type UserRole = "admin" | "teacher" | "student";

export type User = {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
};

export type FacultyProfile = {
  id: number;
  user_id: number;
  faculty_code: string;
  name: string;
  department: string;
  email: string;
  created_at: string;
};

export type DepartmentSummary = {
  id: number;
  name: string;
  code: string;
  batch_start_year: number;
  batch_end_year: number;
  semester_count: number;
  head_user_id?: number | null;
  is_active: boolean;
  created_at: string;
  faculty_count: number;
  student_count: number;
  subject_count: number;
  timetable_slot_count: number;
  attendance_record_count: number;
  result_record_count: number;
  active_batches: number[];
  active_semesters: number[];
};

export type Subject = {
  id: number;
  name: string;
  code?: string | null;
  syllabus?: string | null;
  department: string;
  batch_year: number;
  semester: number;
  created_at: string;
};

export type SubjectPayload = {
  name: string;
  code?: string;
  syllabus?: string | null;
  department: string;
  batch_year: number;
  semester: number;
};

export type ResultRecord = {
  id: number;
  student_id: number;
  subject_id: number;
  subject_name: string;
  assessment_name: string;
  exam_type: string;
  semester?: number | null;
  max_marks: number;
  marks_obtained: number;
  grade: string;
  remarks?: string | null;
  created_at: string;
};

export type Student = {
  id: number;
  enrollment_number: string;
  name: string;
  roll_number?: string | null;
  department: string;
  batch_year: number;
  semester: number;
  email: string;
  created_at: string;
};

export type StudentListResponse = {
  items: Student[];
  total: number;
  page: number;
  page_size: number;
};

export type StudentPayload = {
  name: string;
  roll_number?: string;
  department: string;
  batch_year: number;
  semester: number;
  email: string;
};

export type AttendanceStatus = "present" | "absent" | "late";

export type AttendanceRecord = {
  id: number;
  student_id: number;
  subject_id: number;
  date: string;
  status: AttendanceStatus;
  remarks?: string | null;
};

export type AttendancePercentage = {
  student_id: number;
  subject_id: number;
  total_classes: number;
  attended_classes: number;
  attendance_percentage: number;
};

export type SubjectAttendanceSnapshot = {
  subjectId: number;
  name: string;
  semester?: number | null;
  total: number;
  attended: number;
  absent: number;
  percentage: number;
};

export type AttendanceMarkPayload = {
  student_id: number;
  subject_id: number;
  date: string;
  status: AttendanceStatus;
  remarks?: string;
};

export type AttendanceBulkMarkPayload = {
  timetable_id: number;
  date: string;
  records: {
    student_id: number;
    status: AttendanceStatus;
    remarks?: string;
  }[];
};

export type WeekDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type TimetableEntry = {
  id: number;
  day: WeekDay;
  subject_id: number;
  subject_name: string;
  department: string;
  batch_year: number;
  semester: number;
  faculty_user_id?: number | null;
  room?: string | null;
  start_time: string;
  end_time: string;
};

export type TimetablePayload = {
  day: WeekDay;
  subject_id: number;
  subject_name: string;
  department: string;
  batch_year: number;
  semester: number;
  faculty_user_id: number;
  room?: string;
  start_time: string;
  end_time: string;
};

export type WeeklyTimetablePayload = {
  department: string;
  batch_year: number;
  semester: number;
  slots: {
    day: WeekDay;
    start_time: string;
    subject_id?: number | null;
    faculty_user_id?: number | null;
    room?: string | null;
  }[];
};

export type Holiday = {
  id: number;
  date: string;
  description: string;
};

export type HolidayPayload = {
  date: string;
  description: string;
};

export type AdminCreateUserPayload = {
  full_name?: string;
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
  department?: string;
  batch_year?: number;
  semester?: number;
};

export type AIResponse = {
  answer: string;
  command?: {
    action: "attendance_summary" | "list_absent" | "mark_attendance" | "unsupported";
    student_id?: number | null;
    timetable_id?: number | null;
    date?: string | null;
    present_roll_numbers?: string[];
    absent_roll_numbers?: string[];
    message?: string | null;
  } | null;
  metadata?: Record<string, unknown>;
};

export type ModuleAccess = {
  key: string;
  title: string;
  description: string;
  access_roles: UserRole[];
};

export type FlowNode = {
  entity: string;
  upstream: string[];
  downstream: string[];
  live_records: number;
};

export type OverviewMetrics = {
  department_count: number;
  faculty_count: number;
  student_count: number;
  subject_count: number;
  timetable_slot_count: number;
  attendance_record_count: number;
  result_record_count: number;
};

export type PersonalOverview = {
  label: string;
  department?: string | null;
  batch_year?: number | null;
  semester?: number | null;
  timetable_slot_count: number;
  today_class_count: number;
  assigned_subject_count: number;
  attendance_record_count: number;
  result_record_count: number;
  overall_attendance_percentage?: number | null;
};

export type AcademicOverview = {
  role: UserRole;
  hierarchy: UserRole[];
  metrics: OverviewMetrics;
  modules: ModuleAccess[];
  dependency_flow: FlowNode[];
  departments: DepartmentSummary[];
  personal?: PersonalOverview | null;
};
