import Head from "next/head";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { ActionButton, EmptyState, Field, Notice, PageIntro, SectionCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { DepartmentSummary, User } from "../lib/types";
import { formatLabel, getErrorMessage } from "../lib/utils";

type DepartmentFormState = {
  name: string;
  code: string;
  batch_start_year: string;
  batch_end_year: string;
  semester_count: string;
  head_user_id: string;
  is_active: boolean;
};

const emptyForm: DepartmentFormState = {
  name: "",
  code: "",
  batch_start_year: String(new Date().getFullYear() - 1),
  batch_end_year: String(new Date().getFullYear() + 3),
  semester_count: "8",
  head_user_id: "",
  is_active: true,
};

const DepartmentsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [formState, setFormState] = useState<DepartmentFormState>(emptyForm);

  const headCandidates = useMemo(
    () => users.filter((candidate) => candidate.role === "admin" || candidate.role === "teacher"),
    [users],
  );

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === selectedDepartmentId) || null,
    [departments, selectedDepartmentId],
  );

  const loadWorkspace = async () => {
    setLoading(true);
    setError("");
    try {
      const departmentsResponse = await api.get<DepartmentSummary[]>("/departments");
      const usersResponse = isAdmin ? await api.get<User[]>("/auth/users") : null;
      setDepartments(departmentsResponse.data);
      setUsers(usersResponse?.data || []);
      setSelectedDepartmentId((current) => current ?? departmentsResponse.data[0]?.id ?? null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load departments"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedDepartment) {
      setFormState(emptyForm);
      return;
    }
    setFormState({
      name: selectedDepartment.name,
      code: selectedDepartment.code,
      batch_start_year: String(selectedDepartment.batch_start_year),
      batch_end_year: String(selectedDepartment.batch_end_year),
      semester_count: String(selectedDepartment.semester_count),
      head_user_id: selectedDepartment.head_user_id ? String(selectedDepartment.head_user_id) : "",
      is_active: selectedDepartment.is_active,
    });
  }, [selectedDepartment]);

  const startCreate = () => {
    setSelectedDepartmentId(null);
    setFormState(emptyForm);
    setFeedback("");
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const payload = {
        name: formState.name,
        code: formState.code,
        batch_start_year: Number(formState.batch_start_year),
        batch_end_year: Number(formState.batch_end_year),
        semester_count: Number(formState.semester_count),
        head_user_id: formState.head_user_id ? Number(formState.head_user_id) : null,
        is_active: formState.is_active,
      };
      if (selectedDepartmentId) {
        await api.put(`/departments/${selectedDepartmentId}`, payload);
        setFeedback("Department updated successfully.");
      } else {
        await api.post("/departments", payload);
        setFeedback("Department created successfully.");
      }
      await loadWorkspace();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to save department"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (department: DepartmentSummary) => {
    const confirmed = window.confirm(`Delete ${department.name}? This only works when nothing references it.`);
    if (!confirmed) {
      return;
    }
    setError("");
    setFeedback("");
    try {
      await api.delete(`/departments/${department.id}`);
      setFeedback("Department deleted successfully.");
      setSelectedDepartmentId(null);
      await loadWorkspace();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete department"));
    }
  };

  return (
    <>
      <Head>
        <title>Departments | StudentMS</title>
      </Head>
      <AppLayout title="Departments">
        <PageIntro
          eyebrow="Academic structure"
          title="Department-first administration"
          description="Manage the real department catalog that now drives enrollment numbers, faculty allocation, subjects, timetable scope, and student records."
          actions={isAdmin ? <ActionButton onClick={startCreate}>New department</ActionButton> : null}
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {feedback ? <Notice tone="success">{feedback}</Notice> : null}

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <SectionCard
            title="Department catalog"
            description="Browse live department summaries and jump into the linked students or timetable views."
          >
            {loading ? <p className="text-sm text-slate-500">Fetching department summaries...</p> : null}
            {!loading && departments.length === 0 ? (
              <EmptyState
                title="No departments yet"
                description="Create the first department so student registration, subjects, and timetable planning have a real academic base."
              />
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              {departments.map((department) => (
                <button
                  key={department.id}
                  type="button"
                  onClick={() => setSelectedDepartmentId(department.id)}
                  className={`rounded-[28px] border p-5 text-left transition ${
                    selectedDepartmentId === department.id
                      ? "border-brand-300 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{department.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Code {department.code}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {department.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Students</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{department.student_count}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Subjects</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{department.subject_count}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="rounded-full bg-white px-3 py-1">
                      Batches {department.active_batches.join(", ") || "-"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      Semesters {department.active_semesters.join(", ") || "-"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      Program {department.batch_start_year} to {department.batch_end_year}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      {department.semester_count} semesters
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={{ pathname: "/students", query: { department: department.name } }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      View students
                    </Link>
                    <Link
                      href={{ pathname: "/timetable", query: { department: department.name } }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Open timetable
                    </Link>
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title={selectedDepartmentId ? "Edit department" : "Create department"}
            description="Admins can define the department code used for enrollment numbers and optionally assign a department head."
          >
            {!isAdmin ? (
              <EmptyState
                title="Admin access required"
                description="Teachers and students can review departments, but only admins can create or edit them."
              />
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <Field label="Department name">
                  <input
                    value={formState.name}
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Computer Science"
                  />
                </Field>

                <Field label="Department code" hint="This code will prefix new student enrollment numbers.">
                  <input
                    value={formState.code}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                    }
                    placeholder="CS"
                  />
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Batch start year" hint="First intake year available for this department.">
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={formState.batch_start_year}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, batch_start_year: event.target.value }))
                      }
                    />
                  </Field>

                  <Field label="Batch end year" hint="Last intake year currently open for admissions.">
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={formState.batch_end_year}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, batch_end_year: event.target.value }))
                      }
                    />
                  </Field>
                </div>

                <Field label="Semester count" hint="Total number of semesters for this program.">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={formState.semester_count}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, semester_count: event.target.value }))
                    }
                  />
                </Field>

                <Field label="Department head">
                  <select
                    value={formState.head_user_id}
                    onChange={(event) => setFormState((current) => ({ ...current, head_user_id: event.target.value }))}
                  >
                    <option value="">No head assigned</option>
                    {headCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.email} ({formatLabel(candidate.role)})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    value={String(formState.is_active)}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, is_active: event.target.value === "true" }))
                    }
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </Field>

                <div className="flex flex-wrap gap-3 pt-2">
                  <ActionButton type="submit" disabled={saving}>
                    {saving ? "Saving..." : selectedDepartmentId ? "Save changes" : "Create department"}
                  </ActionButton>
                  <ActionButton type="button" variant="secondary" onClick={startCreate}>
                    Clear form
                  </ActionButton>
                  {selectedDepartment ? (
                    <ActionButton
                      type="button"
                      variant="danger"
                      onClick={() => void handleDelete(selectedDepartment)}
                    >
                      Delete department
                    </ActionButton>
                  ) : null}
                </div>
              </form>
            )}
          </SectionCard>
        </section>
      </AppLayout>
    </>
  );
};

export default DepartmentsPage;
