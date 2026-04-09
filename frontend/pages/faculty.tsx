import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { AccessDenied, ActionButton, Badge, EmptyState, Notice, PageIntro, SectionCard, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useDepartmentCatalog } from "../lib/useDepartmentCatalog";
import { FacultyProfile, Subject, TimetableEntry } from "../lib/types";
import { formatLabel, formatTime, getErrorMessage } from "../lib/utils";

const FacultyPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { catalog, error: catalogError } = useDepartmentCatalog(isAdmin);
  const [faculty, setFaculty] = useState<FacultyProfile[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyProfile | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [appliedDepartment, setAppliedDepartment] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredFaculty = useMemo(() => {
    return faculty.filter((profile) => {
      const matchesDepartment = appliedDepartment ? profile.department === appliedDepartment : true;
      const needle = appliedSearch.trim().toLowerCase();
      const matchesSearch = needle
        ? profile.name.toLowerCase().includes(needle)
          || profile.email.toLowerCase().includes(needle)
          || profile.faculty_code.toLowerCase().includes(needle)
        : true;
      return matchesDepartment && matchesSearch;
    });
  }, [appliedDepartment, appliedSearch, faculty]);

  const selectedEntries = useMemo(
    () => timetableEntries.filter((entry) => entry.faculty_user_id === selectedFaculty?.user_id),
    [selectedFaculty?.user_id, timetableEntries],
  );

  const selectedSubjects = useMemo(() => {
    const subjectIds = new Set(selectedEntries.map((entry) => entry.subject_id));
    return subjects.filter((subject) => subjectIds.has(subject.id));
  }, [selectedEntries, subjects]);

  const classesPerDay = useMemo(() => {
    const totals = new Map<string, number>();
    selectedEntries.forEach((entry) => {
      totals.set(entry.day, (totals.get(entry.day) || 0) + 1);
    });
    return Array.from(totals.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [selectedEntries]);

  const rosterSummary = useMemo(() => {
    const grouped = new Map<string, { department: string; batchYear: number; semester: number; count: number }>();
    selectedEntries.forEach((entry) => {
      const key = `${entry.department}-${entry.batch_year}-${entry.semester}`;
      const current = grouped.get(key) || {
        department: entry.department,
        batchYear: entry.batch_year,
        semester: entry.semester,
        count: 0,
      };
      current.count += 1;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((left, right) =>
      `${left.department}-${left.batchYear}-${left.semester}`.localeCompare(`${right.department}-${right.batchYear}-${right.semester}`),
    );
  }, [selectedEntries]);

  const loadFacultyWorkspace = async () => {
    setLoading(true);
    setError("");
    try {
      const [facultyResponse, timetableResponse, subjectsResponse] = await Promise.all([
        api.get<FacultyProfile[]>("/faculty"),
        api.get<TimetableEntry[]>("/timetable"),
        api.get<Subject[]>("/subjects"),
      ]);
      setFaculty(facultyResponse.data);
      setTimetableEntries(timetableResponse.data);
      setSubjects(subjectsResponse.data);
      setSelectedFaculty((current) => current || facultyResponse.data[0] || null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load faculty records"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    void loadFacultyWorkspace();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedFaculty) {
      return;
    }
    setDetailLoading(true);
    const timer = window.setTimeout(() => setDetailLoading(false), 120);
    return () => window.clearTimeout(timer);
  }, [selectedFaculty]);

  useEffect(() => {
    if (filteredFaculty.length === 0) {
      setSelectedFaculty(null);
      return;
    }
    if (!selectedFaculty || !filteredFaculty.some((profile) => profile.id === selectedFaculty.id)) {
      setSelectedFaculty(filteredFaculty[0]);
    }
  }, [filteredFaculty, selectedFaculty]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedDepartment(departmentFilter);
    setAppliedSearch(search);
  };

  return (
    <>
      <Head>
        <title>Faculty | StudentMS</title>
      </Head>
      <AppLayout title="Faculty">
        <PageIntro
          eyebrow="Faculty directory"
          title="Faculty records and teaching load"
          description="Browse department faculty, open a teacher profile, and review the live weekly teaching allocation that feeds attendance and timetable visibility."
        />

        {!isAdmin ? (
          <AccessDenied message="Only admins can open the faculty directory from this workspace." />
        ) : (
          <>
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {catalogError ? <Notice tone="danger">{catalogError}</Notice> : null}

            <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
              <SectionCard
                title="Faculty list"
                description="Filter the faculty directory by department or search by name, email, or faculty code."
                actions={
                  <form onSubmit={handleSearch} className="grid w-full gap-2 sm:grid-cols-3">
                    <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                      <option value="">All departments</option>
                      {catalog.map((department) => (
                        <option key={department.id} value={department.name}>{department.name}</option>
                      ))}
                    </select>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search faculty" />
                    <ActionButton type="submit">Apply filters</ActionButton>
                  </form>
                }
              >
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Faculty</th>
                        <th className="px-4 py-3 font-medium">Code</th>
                        <th className="px-4 py-3 font-medium">Department</th>
                        <th className="px-4 py-3 font-medium">Assigned classes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {loading ? <tr><td className="px-4 py-8 text-slate-500" colSpan={4}>Loading faculty records...</td></tr> : null}
                      {!loading && filteredFaculty.length === 0 ? (
                        <tr>
                          <td className="px-4 py-8" colSpan={4}>
                            <EmptyState title="No faculty found" description="Adjust the filters or create faculty accounts from the Admin Users page." />
                          </td>
                        </tr>
                      ) : null}
                      {filteredFaculty.map((profile) => {
                        const assignedCount = timetableEntries.filter((entry) => entry.faculty_user_id === profile.user_id).length;
                        const active = selectedFaculty?.id === profile.id;
                        return (
                          <tr key={profile.id} className={active ? "bg-brand-50" : "hover:bg-slate-50"}>
                            <td className="px-4 py-4">
                              <button type="button" onClick={() => setSelectedFaculty(profile)} className="text-left">
                                <p className="font-semibold text-slate-900 hover:text-brand-700">{profile.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{profile.email}</p>
                              </button>
                            </td>
                            <td className="px-4 py-4 text-slate-600">{profile.faculty_code}</td>
                            <td className="px-4 py-4 text-slate-600">{profile.department}</td>
                            <td className="px-4 py-4 text-slate-600">{assignedCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard
                title={selectedFaculty ? `${selectedFaculty.name} profile` : "Faculty profile"}
                description={selectedFaculty ? "Teaching allocation, timetable coverage, and batch reach based on the live weekly schedule." : "Select a faculty member from the table to load profile details here."}
              >
                {!selectedFaculty ? (
                  <EmptyState title="Choose a faculty member" description="Their profile, assigned subjects, and weekly class plan will appear here." />
                ) : detailLoading ? (
                  <p className="text-sm text-slate-500">Loading faculty profile...</p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <p className="text-2xl font-semibold tracking-tight text-slate-950">{selectedFaculty.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedFaculty.email}</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <StatCard label="Faculty code" value={selectedFaculty.faculty_code} />
                      <StatCard label="Department" value={selectedFaculty.department} />
                      <StatCard label="Weekly classes" value={selectedEntries.length} />
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-slate-950">Assigned subjects</h3>
                      {selectedSubjects.length === 0 ? <EmptyState title="No subjects linked yet" description="Assign this faculty member to timetable slots and their teaching subjects will appear here." /> : null}
                      {selectedSubjects.map((subject) => {
                        const weeklyCount = selectedEntries.filter((entry) => entry.subject_id === subject.id).length;
                        return (
                          <div key={subject.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{subject.name}</p>
                                <p className="mt-1 text-sm text-slate-500">{subject.department} - {subject.batch_year} batch - Semester {subject.semester}</p>
                              </div>
                              <Badge tone="brand">{weeklyCount} classes/week</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-slate-950">Batches reached</h3>
                      {rosterSummary.length === 0 ? <EmptyState title="No batch allocation yet" description="Once classes are scheduled, the connected department, batch, and semester groups will appear here." /> : null}
                      {rosterSummary.map((item) => (
                        <div key={`${item.department}-${item.batchYear}-${item.semester}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{item.department}</p>
                              <p className="mt-1 text-sm text-slate-500">{item.batchYear} batch - Semester {item.semester}</p>
                            </div>
                            <Badge>{item.count} weekly slots</Badge>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-slate-950">Weekly schedule</h3>
                      {classesPerDay.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-3">
                          {classesPerDay.map(([day, count]) => (
                            <StatCard key={day} label={formatLabel(day)} value={count} hint="Scheduled classes" />
                          ))}
                        </div>
                      ) : null}
                      {selectedEntries.length === 0 ? <EmptyState title="No timetable assigned" description="This faculty member does not yet have any classes in the repeating weekly planner." /> : null}
                      {selectedEntries.length > 0 ? (
                        <div className="space-y-3">
                          {selectedEntries.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">{entry.subject_name}</p>
                                  <p className="mt-1 text-sm text-slate-500">{formatLabel(entry.day)} | {formatTime(entry.start_time)} to {formatTime(entry.end_time)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-slate-900">{entry.batch_year} batch</p>
                                  <p className="mt-1 text-xs text-slate-500">Semester {entry.semester}{entry.room ? ` - Room ${entry.room}` : ""}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </SectionCard>
            </section>
          </>
        )}
      </AppLayout>
    </>
  );
};

export default FacultyPage;
