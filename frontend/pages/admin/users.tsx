import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppLayout } from "../../components/AppLayout";
import { AccessDenied, ActionButton, EmptyState, Notice, PageIntro, SectionCard } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { getDepartmentOption } from "../../lib/academic";
import { api } from "../../lib/api";
import { useDepartmentCatalog } from "../../lib/useDepartmentCatalog";
import { AdminCreateUserPayload } from "../../lib/types";
import { getErrorMessage } from "../../lib/utils";

type ProvisioningTab = "student" | "teacher" | "admin";

const createStudentForm = (department?: string, batchYear?: number, semester?: number): AdminCreateUserPayload => ({
  full_name: "",
  email: "",
  password: "",
  role: "student",
  is_active: true,
  department,
  batch_year: batchYear,
  semester,
});

const createTeacherForm = (department?: string): AdminCreateUserPayload => ({
  full_name: "",
  email: "",
  password: "",
  role: "teacher",
  is_active: true,
  department,
});

const defaultAdminForm: AdminCreateUserPayload = {
  email: "",
  password: "",
  role: "admin",
  is_active: true,
};

const tabCopy: Record<ProvisioningTab, { title: string; description: string; submitLabel: string }> = {
  student: {
    title: "Student registration",
    description: "Capture the academic details first so the enrollment number can be generated against the right department and batch.",
    submitLabel: "Create student",
  },
  teacher: {
    title: "Faculty registration",
    description: "Create a faculty login tied to one department so timetable and attendance permissions stay scoped correctly.",
    submitLabel: "Create faculty",
  },
  admin: {
    title: "Admin access",
    description: "Provision additional admin accounts without the academic profile fields used for students and faculty.",
    submitLabel: "Create admin",
  },
};

const AdminUsersPage = () => {
  const { user } = useAuth();
  const { catalog, fallbackDepartment, loading: departmentsLoading, error: departmentsError } = useDepartmentCatalog(
    user?.role === "admin",
  );
  const [activeTab, setActiveTab] = useState<ProvisioningTab>("student");
  const [studentForm, setStudentForm] = useState<AdminCreateUserPayload>(createStudentForm());
  const [teacherForm, setTeacherForm] = useState<AdminCreateUserPayload>(createTeacherForm());
  const [adminForm, setAdminForm] = useState<AdminCreateUserPayload>(defaultAdminForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const studentDepartmentConfig = useMemo(
    () => getDepartmentOption(catalog, studentForm.department) || fallbackDepartment,
    [catalog, fallbackDepartment, studentForm.department],
  );

  useEffect(() => {
    if (!fallbackDepartment) {
      return;
    }
    setStudentForm((current) =>
      current.department
        ? current
        : createStudentForm(
            fallbackDepartment.name,
            fallbackDepartment.batches[0],
            fallbackDepartment.semesters[0],
          ),
    );
    setTeacherForm((current) => (current.department ? current : createTeacherForm(fallbackDepartment.name)));
  }, [fallbackDepartment]);

  const submitForm = async (payload: AdminCreateUserPayload) => {
    setLoading(true);
    setError("");
    setFeedback("");

    try {
      await api.post("/auth/users", payload);
      setFeedback(
        payload.role === "student"
          ? "Student account created. Enrollment number was assigned automatically."
          : payload.role === "teacher"
            ? "Faculty account created. Faculty code was assigned automatically."
            : "Admin account created successfully.",
      );
      if (payload.role === "student") {
        setStudentForm(
          createStudentForm(
            fallbackDepartment?.name,
            fallbackDepartment?.batches[0],
            fallbackDepartment?.semesters[0],
          ),
        );
      }
      if (payload.role === "teacher") {
        setTeacherForm(createTeacherForm(fallbackDepartment?.name));
      }
      if (payload.role === "admin") {
        setAdminForm(defaultAdminForm);
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to create user account"));
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitForm({ ...studentForm, role: "student" });
  };

  const handleTeacherSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitForm({ ...teacherForm, role: "teacher" });
  };

  const handleAdminSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitForm({ ...adminForm, role: "admin" });
  };

  return (
    <>
      <Head>
        <title>Admin Users | EdXplore</title>
      </Head>
      <AppLayout title="Admin Users">
        <PageIntro
          eyebrow="Admin provisioning"
          title="Register students, faculty, and admins from dedicated tabs"
          description="Registration is now separated into focused workflows so admins are guided by the right fields instead of picking a role from a single dropdown."
        />

        {user?.role !== "admin" ? (
          <AccessDenied message="Only admin accounts can provision new users and assign roles." />
        ) : departmentsLoading ? (
          <SectionCard title="Loading academic catalog" description="Fetching live departments for role-aware provisioning.">
            <p className="text-sm text-slate-500">Preparing department, batch, and semester options...</p>
          </SectionCard>
        ) : catalog.length === 0 ? (
          <SectionCard title="Departments required" description="User provisioning depends on the academic structure from the backend.">
            <EmptyState
              title="Create a department first"
              description="Students and teachers need a real department before they can be provisioned with the correct role scope."
            />
          </SectionCard>
        ) : (
          <SectionCard title={tabCopy[activeTab].title} description={tabCopy[activeTab].description}>
            {departmentsError ? <Notice tone="danger">{departmentsError}</Notice> : null}
            {error ? <Notice tone="danger">{error}</Notice> : null}
            {feedback ? <Notice tone="success">{feedback}</Notice> : null}

            <div className="mb-6 flex flex-wrap gap-3">
              {(["student", "teacher", "admin"] as ProvisioningTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab
                      ? "bg-brand-600 text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                  }`}
                >
                  {tab === "student" ? "Student tab" : tab === "teacher" ? "Faculty tab" : "Admin tab"}
                </button>
              ))}
            </div>

            {activeTab === "student" ? (
              <form className="grid gap-4 lg:max-w-2xl" onSubmit={(event) => void handleStudentSubmit(event)}>
                <input value={studentForm.full_name || ""} onChange={(event) => setStudentForm((current) => ({ ...current, full_name: event.target.value }))} placeholder="Student full name" />
                <input type="email" value={studentForm.email} onChange={(event) => setStudentForm((current) => ({ ...current, email: event.target.value }))} placeholder="Student email" />
                <input type="password" value={studentForm.password} onChange={(event) => setStudentForm((current) => ({ ...current, password: event.target.value }))} placeholder="Temporary or initial password" />
                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    value={studentForm.department || fallbackDepartment?.name || ""}
                    onChange={(event) => {
                      const config = getDepartmentOption(catalog, event.target.value) || fallbackDepartment;
                      if (!config) {
                        return;
                      }
                      setStudentForm((current) => ({
                        ...current,
                        department: config.name,
                        batch_year: config.batches[0],
                        semester: config.semesters[0],
                      }));
                    }}
                  >
                    {catalog.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}
                  </select>
                  <select value={String(studentForm.is_active)} onChange={(event) => setStudentForm((current) => ({ ...current, is_active: event.target.value === "true" }))}>
                    <option value="true">Active on creation</option>
                    <option value="false">Create as inactive</option>
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <select value={String(studentForm.batch_year || studentDepartmentConfig?.batches[0] || "")} onChange={(event) => setStudentForm((current) => ({ ...current, batch_year: Number(event.target.value) }))}>
                    {(studentDepartmentConfig?.batches || []).map((batch) => <option key={batch} value={batch}>{batch} batch</option>)}
                  </select>
                  <select value={String(studentForm.semester || studentDepartmentConfig?.semesters[0] || "")} onChange={(event) => setStudentForm((current) => ({ ...current, semester: Number(event.target.value) }))}>
                    {(studentDepartmentConfig?.semesters || []).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
                  </select>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">The student&apos;s enrollment number is generated automatically from the selected department and batch.</div>
                <ActionButton type="submit" disabled={loading}>{loading ? "Creating..." : tabCopy.student.submitLabel}</ActionButton>
              </form>
            ) : null}

            {activeTab === "teacher" ? (
              <form className="grid gap-4 lg:max-w-2xl" onSubmit={(event) => void handleTeacherSubmit(event)}>
                <input value={teacherForm.full_name || ""} onChange={(event) => setTeacherForm((current) => ({ ...current, full_name: event.target.value }))} placeholder="Faculty full name" />
                <input type="email" value={teacherForm.email} onChange={(event) => setTeacherForm((current) => ({ ...current, email: event.target.value }))} placeholder="Faculty email" />
                <input type="password" value={teacherForm.password} onChange={(event) => setTeacherForm((current) => ({ ...current, password: event.target.value }))} placeholder="Temporary or initial password" />
                <div className="grid gap-4 md:grid-cols-2">
                  <select value={teacherForm.department || fallbackDepartment?.name || ""} onChange={(event) => setTeacherForm((current) => ({ ...current, department: event.target.value }))}>
                    {catalog.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}
                  </select>
                  <select value={String(teacherForm.is_active)} onChange={(event) => setTeacherForm((current) => ({ ...current, is_active: event.target.value === "true" }))}>
                    <option value="true">Active on creation</option>
                    <option value="false">Create as inactive</option>
                  </select>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">The faculty code is generated automatically after the teacher account is created.</div>
                <ActionButton type="submit" disabled={loading}>{loading ? "Creating..." : tabCopy.teacher.submitLabel}</ActionButton>
              </form>
            ) : null}

            {activeTab === "admin" ? (
              <form className="grid gap-4 lg:max-w-2xl" onSubmit={(event) => void handleAdminSubmit(event)}>
                <input type="email" value={adminForm.email} onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))} placeholder="Admin email" />
                <input type="password" value={adminForm.password} onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))} placeholder="Temporary or initial password" />
                <select value={String(adminForm.is_active)} onChange={(event) => setAdminForm((current) => ({ ...current, is_active: event.target.value === "true" }))}>
                  <option value="true">Active on creation</option>
                  <option value="false">Create as inactive</option>
                </select>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Admin accounts skip department, batch, and semester because they are system-wide operators.</div>
                <ActionButton type="submit" disabled={loading}>{loading ? "Creating..." : tabCopy.admin.submitLabel}</ActionButton>
              </form>
            ) : null}
          </SectionCard>
        )}
      </AppLayout>
    </>
  );
};

export default AdminUsersPage;
