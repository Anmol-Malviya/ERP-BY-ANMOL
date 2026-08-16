import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarCheck2,
  Check,
  Clock3,
  RefreshCw,
  Save,
  Search,
  UsersRound,
} from 'lucide-react';
import { PERMISSIONS } from '@erp/contracts';
import { api } from '../api';
import { useAuth } from '../auth';
import '../attendance.css';

type Student = {
  _id: string;
  firstName: string;
  lastName?: string;
  admissionNo: string;
  rollNo?: string;
  status?: string;
  remark?: string;
};

type Session = { _id: string; name: string; isCurrent?: boolean };
type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
type FacultyStatus = Status | 'HALF_DAY';

type FacultyRecord = {
  personId: string;
  personType: 'TEACHER' | 'STAFF';
  status: FacultyStatus;
  checkIn: string;
  checkOut: string;
};

const statuses: Status[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
const today = () => new Date().toISOString().slice(0, 10);

export default function Attendance() {
  const { user } = useAuth();
  const canMark = !!user?.permissions?.includes(PERMISSIONS.ATTENDANCE_MARK);
  const canStaffWrite = !!user?.permissions?.includes(PERMISSIONS.STAFF_WRITE);
  const showFaculty = ['SCHOOL_ADMIN', 'HR_MANAGER', 'TEACHER'].includes(user?.role || '');
  const [tab, setTab] = useState<'mark' | 'records' | 'faculty'>(canMark ? 'mark' : 'records');

  return (
    <div className="page attendance-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Attendance · Daily operations</div>
          <h1>Attendance</h1>
          <p>
            Role-scoped attendance with server-validated rosters, academic references,
            subject assignments and audit trails. Student and Parent records remain limited
            to linked profiles.
          </p>
        </div>
      </div>

      <div className="attendance-tabs">
        {canMark && (
          <button className={tab === 'mark' ? 'active' : ''} onClick={() => setTab('mark')}>
            <CalendarCheck2 /> Mark attendance
          </button>
        )}
        <button className={tab === 'records' ? 'active' : ''} onClick={() => setTab('records')}>
          <BarChart3 /> Student records
        </button>
        {showFaculty && (
          <button className={tab === 'faculty' ? 'active' : ''} onClick={() => setTab('faculty')}>
            <UsersRound /> {canStaffWrite ? 'Faculty attendance' : 'My faculty attendance'}
          </button>
        )}
      </div>

      {tab === 'mark' && canMark ? (
        <MarkAttendance />
      ) : tab === 'faculty' && showFaculty ? (
        <FacultyAttendance canWrite={canStaffWrite} />
      ) : (
        <AttendanceRecords />
      )}
    </div>
  );
}

function MarkAttendance() {
  const [options, setOptions] = useState<any>(null);
  const [mode, setMode] = useState<'DAILY' | 'SUBJECT'>('SUBJECT');
  const [sessionId, setSessionId] = useState('');
  const [date, setDate] = useState(today());
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [period, setPeriod] = useState(1);
  const [assignmentId, setAssignmentId] = useState('');
  const [roster, setRoster] = useState<Student[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const response: any = await api('/attendance/marking-options');
        setOptions(response.data);
        const current =
          (response.data.sessions || []).find((session: any) => session.isCurrent) ||
          response.data.sessions?.[0];
        if (current) setSessionId(String(current._id));

        if (response.data.mode === 'TEACHER') {
          const first = response.data.assignments?.[0];
          if (first) {
            setAssignmentId(String(first.id));
            setSectionId(String(first.sectionId));
            setSubjectId(String(first.subjectId));
          } else if (response.data.dailySections?.[0]) {
            setMode('DAILY');
            setSectionId(String(response.data.dailySections[0].sectionId));
          }
        }
      } catch (caught: any) {
        setError(caught.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const teacherMode = options?.mode === 'TEACHER';
  const assignments = options?.assignments || [];
  const adminSections = options?.sections || [];
  const adminSubjects = options?.subjects || [];
  const selectedAssignment = assignments.find((assignment: any) => String(assignment.id) === assignmentId);

  useEffect(() => {
    if (!teacherMode || mode !== 'SUBJECT' || !selectedAssignment) return;
    setSectionId(String(selectedAssignment.sectionId));
    setSubjectId(String(selectedAssignment.subjectId));
  }, [assignmentId, mode, selectedAssignment, teacherMode]);

  useEffect(() => {
    if (mode === 'DAILY') setSubjectId('');
  }, [mode]);

  const loadRoster = async () => {
    if (!sessionId || !sectionId) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const params = new URLSearchParams({ sectionId, date, sessionId });
      if (mode === 'SUBJECT') {
        if (!subjectId) throw new Error('Select a subject assignment');
        params.set('subjectId', subjectId);
        params.set('period', String(period));
      }
      const response: any = await api(`/attendance/roster?${params}`);
      setRoster(
        (response.data.students || []).map((student: any) => ({
          ...student,
          status: student.status || 'PRESENT',
          remark: student.remark || '',
        })),
      );
    } catch (caught: any) {
      setError(caught.message);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId && sectionId) void loadRoster();
    // loadRoster intentionally depends on the attendance context below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sectionId, subjectId, period, date, mode]);

  const setAll = (status: Status) => setRoster((rows) => rows.map((row) => ({ ...row, status })));
  const setRow = (id: string, key: 'status' | 'remark', value: string) =>
    setRoster((rows) => rows.map((row) => (row._id === id ? { ...row, [key]: value } : row)));

  const save = async () => {
    if (!roster.length) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api('/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({
          date,
          sessionId,
          sectionId,
          subjectId: mode === 'SUBJECT' ? subjectId : undefined,
          period: mode === 'SUBJECT' ? period : undefined,
          records: roster.map((row) => ({
            studentId: row._id,
            status: row.status || 'PRESENT',
            remark: row.remark || undefined,
          })),
        }),
      });
      setMessage(`Saved attendance for ${roster.length} students.`);
      await loadRoster();
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return normalized
      ? roster.filter((row) =>
          `${row.firstName} ${row.lastName || ''} ${row.admissionNo} ${row.rollNo || ''}`
            .toLowerCase()
            .includes(normalized),
        )
      : roster;
  }, [roster, query]);

  const counts = Object.fromEntries(
    statuses.map((status) => [status, roster.filter((row) => row.status === status).length]),
  );

  return (
    <>
      <section className="attendance-controls">
        <div className="attendance-control-row">
          <label>
            Mode
            <select
              value={mode}
              onChange={(event) => {
                const next = event.target.value as 'DAILY' | 'SUBJECT';
                setMode(next);
                if (teacherMode && next === 'DAILY') {
                  const daily = options?.dailySections?.[0];
                  setSectionId(daily ? String(daily.sectionId) : '');
                } else if (teacherMode && next === 'SUBJECT' && selectedAssignment) {
                  setSectionId(String(selectedAssignment.sectionId));
                  setSubjectId(String(selectedAssignment.subjectId));
                }
              }}
            >
              <option value="SUBJECT">Subject / period</option>
              <option value="DAILY">Daily class attendance</option>
            </select>
          </label>

          <label>
            Academic session
            <select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
              {(options?.sessions || []).map((session: Session) => (
                <option key={session._id} value={session._id}>
                  {session.name}
                  {session.isCurrent ? ' · Current' : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          {teacherMode ? (
            mode === 'SUBJECT' ? (
              <label className="wide-control">
                Teaching assignment
                <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
                  <option value="">Select assignment</option>
                  {assignments.map((assignment: any) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.className} · {assignment.sectionName} · {assignment.subjectName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Class section
                <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                  <option value="">Select class-teacher section</option>
                  {(options?.dailySections || []).map((section: any) => (
                    <option key={section.sectionId} value={section.sectionId}>
                      {section.className} · {section.sectionName}
                    </option>
                  ))}
                </select>
              </label>
            )
          ) : (
            <>
              <label>
                Section
                <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                  <option value="">Select section</option>
                  {adminSections.map((section: any) => (
                    <option key={section._id} value={section._id}>
                      {refName(section.classId, options?.classes || [])} · {section.name}
                    </option>
                  ))}
                </select>
              </label>
              {mode === 'SUBJECT' && (
                <label>
                  Subject
                  <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                    <option value="">Select subject</option>
                    {adminSubjects.map((subject: any) => (
                      <option key={subject._id} value={subject._id}>
                        {subject.name} · {subject.code}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {mode === 'SUBJECT' && (
            <label>
              Period
              <input
                type="number"
                min="1"
                max="30"
                value={period}
                onChange={(event) => setPeriod(Number(event.target.value))}
              />
            </label>
          )}
        </div>
      </section>

      {error && <div className="form-error attendance-error">{error}</div>}
      {message && (
        <div className="attendance-success">
          <Check /> {message}
        </div>
      )}

      <div className="attendance-summary">
        {statuses.map((status) => (
          <div key={status}>
            <span className={`status-dot-lg ${status.toLowerCase()}`} />
            <div>
              <small>{status}</small>
              <b>{counts[status] || 0}</b>
            </div>
          </div>
        ))}
      </div>

      <section className="roster-surface">
        <div className="roster-toolbar">
          <label>
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roster…" />
          </label>
          <div className="bulk-status">
            Mark all:
            {statuses.map((status) => (
              <button key={status} onClick={() => setAll(status)}>
                {status[0]}
              </button>
            ))}
          </div>
          <button className="primary-btn" disabled={saving || !roster.length} onClick={() => void save()}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save attendance'}
          </button>
        </div>

        <div className="roster-table">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll</th>
                <th>Status</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row._id}>
                  <td>
                    <div className="attendance-person">
                      <span>{row.firstName?.[0]}</span>
                      <div>
                        <b>{row.firstName} {row.lastName || ''}</b>
                        <small>{row.admissionNo}</small>
                      </div>
                    </div>
                  </td>
                  <td>{row.rollNo || '—'}</td>
                  <td>
                    <StatusButtons
                      value={(row.status || 'PRESENT') as Status}
                      onChange={(value) => setRow(row._id, 'status', value)}
                    />
                  </td>
                  <td>
                    <input
                      className="remark-input"
                      value={row.remark || ''}
                      onChange={(event) => setRow(row._id, 'remark', event.target.value)}
                      maxLength={300}
                      placeholder="Optional"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="roster-mobile">
          {visible.map((row) => (
            <div key={row._id}>
              <div className="attendance-person">
                <span>{row.firstName?.[0]}</span>
                <div>
                  <b>{row.firstName} {row.lastName || ''}</b>
                  <small>{row.admissionNo} · Roll {row.rollNo || '—'}</small>
                </div>
              </div>
              <StatusButtons
                value={(row.status || 'PRESENT') as Status}
                onChange={(value) => setRow(row._id, 'status', value)}
              />
              <input
                className="remark-input"
                value={row.remark || ''}
                onChange={(event) => setRow(row._id, 'remark', event.target.value)}
                maxLength={300}
                placeholder="Optional remark"
              />
            </div>
          ))}
        </div>

        {loading && <div className="attendance-loading">Loading roster…</div>}
        {!loading && !roster.length && (
          <div className="attendance-empty">
            <UsersRound />
            <b>No roster loaded</b>
            <span>Select a valid section/assignment and attendance context.</span>
          </div>
        )}
      </section>
    </>
  );
}

function StatusButtons({ value, onChange }: { value: Status; onChange: (value: Status) => void }) {
  return (
    <div className="status-buttons">
      {statuses.map((status) => (
        <button
          key={status}
          className={`${status.toLowerCase()} ${value === status ? 'active' : ''}`}
          onClick={() => onChange(status)}
          title={status}
        >
          {status[0]}
        </button>
      ))}
    </div>
  );
}

function AttendanceRecords() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const response: any = await api('/students?limit=200');
        setStudents(response.data || []);
        if (response.data?.[0]) setStudentId(String(response.data[0]._id));
      } catch (caught: any) {
        setError(caught.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!studentId) return;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [summaryResponse, recordsResponse]: any[] = await Promise.all([
          api(`/attendance/summary/${studentId}`),
          api(`/attendance?studentId=${studentId}`),
        ]);
        setSummary(summaryResponse.data);
        setRows(recordsResponse.data || []);
      } catch (caught: any) {
        setError(caught.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  const visible = useMemo(() => {
    const normalized = query.toLowerCase();
    return normalized
      ? rows.filter((row) =>
          `${row.status} ${row.subjectId?.name || ''} ${new Date(row.date).toLocaleDateString()}`
            .toLowerCase()
            .includes(normalized),
        )
      : rows;
  }, [rows, query]);

  const breakdown = Object.fromEntries(
    (summary?.breakdown || []).map((item: any) => [item._id, item.count]),
  );

  return (
    <>
      <section className="record-controls">
        <label>
          Student
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {students.map((student) => (
              <option key={student._id} value={student._id}>
                {student.firstName} {student.lastName || ''} · {student.admissionNo}
              </option>
            ))}
          </select>
        </label>
        <label className="record-search">
          <Search />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter history…" />
        </label>
      </section>

      {error && <div className="form-error attendance-error">{error}</div>}

      <div className="attendance-kpis">
        <div>
          <span>Attendance</span>
          <b>{Number(summary?.percentage || 0).toFixed(1)}%</b>
          <small>Present + late weighted as attended</small>
        </div>
        <div>
          <span>Present</span>
          <b>{breakdown.PRESENT || 0}</b>
          <small>of {summary?.total || 0} records</small>
        </div>
        <div>
          <span>Absent</span>
          <b>{breakdown.ABSENT || 0}</b>
          <small>Recorded absences</small>
        </div>
        <div>
          <span>Leave / Late</span>
          <b>{(breakdown.LEAVE || 0) + (breakdown.LATE || 0)}</b>
          <small>Combined exceptions</small>
        </div>
      </div>

      <section className="attendance-history">
        <div className="attendance-history-head">
          <div>
            <small>RECENT RECORDS</small>
            <h2>{visible.length} entries</h2>
          </div>
          <RefreshCw size={15} />
        </div>
        {visible.map((row: any) => (
          <div className="attendance-history-row" key={row._id}>
            <span className={`history-status ${String(row.status).toLowerCase()}`}>{row.status}</span>
            <div>
              <b>{row.subjectId?.name || 'Daily attendance'}</b>
              <small>
                {new Date(row.date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
                {row.period ? ` · Period ${row.period}` : ''}
              </small>
            </div>
            <p>{row.remark || 'No remark'}</p>
          </div>
        ))}
        {!loading && !visible.length && (
          <div className="attendance-empty">
            <BarChart3 />
            <b>No attendance records</b>
            <span>Records visible to this role will appear here.</span>
          </div>
        )}
      </section>
    </>
  );
}

function FacultyAttendance({ canWrite }: { canWrite: boolean }) {
  const [date, setDate] = useState(today());
  const [people, setPeople] = useState<any[]>([]);
  const [records, setRecords] = useState<FacultyRecord[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const historyResponse: any = await api(`/faculty-attendance${canWrite ? `?date=${date}` : ''}`);
      setHistory(historyResponse.data || []);

      if (canWrite) {
        const [teacherResponse, staffResponse]: any[] = await Promise.all([
          api('/teachers?limit=400'),
          api('/staff?limit=400'),
        ]);
        const all = [
          ...(teacherResponse.data || []).map((person: any) => ({ ...person, personType: 'TEACHER' as const })),
          ...(staffResponse.data || []).map((person: any) => ({ ...person, personType: 'STAFF' as const })),
        ];
        setPeople(all);
        const byPerson = new Map<string, any>(
          (historyResponse.data || []).map((item: any) => [
            `${item.personType}:${item.personId}`,
            item,
          ]),
        );
        setRecords(
          all.map((person: any) => {
            const old = byPerson.get(`${person.personType}:${person._id}`);
            return {
              personId: String(person._id),
              personType: person.personType,
              status: (old?.status || 'PRESENT') as FacultyStatus,
              checkIn: old?.checkIn || '',
              checkOut: old?.checkOut || '',
            };
          }),
        );
      }
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, canWrite]);

  const change = (id: string, type: string, key: keyof FacultyRecord, value: string) =>
    setRecords((rows) =>
      rows.map((row) =>
        row.personId === id && row.personType === type ? { ...row, [key]: value } as FacultyRecord : row,
      ),
    );

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api('/faculty-attendance/mark', {
        method: 'POST',
        body: JSON.stringify({ date, records }),
      });
      setMessage(`Saved ${records.length} faculty records.`);
      await load();
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {error && <div className="form-error attendance-error">{error}</div>}
      {message && (
        <div className="attendance-success">
          <Check /> {message}
        </div>
      )}

      {canWrite ? (
        <section className="faculty-surface">
          <div className="faculty-toolbar">
            <label>
              Date
              <input type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <button className="primary-btn" disabled={saving || !records.length} onClick={() => void save()}>
              <Save size={14} /> {saving ? 'Saving…' : 'Save faculty attendance'}
            </button>
          </div>

          <div className="faculty-list">
            {people.map((person, index) => {
              const row = records[index] || ({} as FacultyRecord);
              return (
                <div key={`${person.personType}-${person._id}`}>
                  <div className="attendance-person">
                    <span>{person.firstName?.[0]}</span>
                    <div>
                      <b>{person.firstName} {person.lastName || ''}</b>
                      <small>{person.personType} · {person.employeeNo || person.department || '—'}</small>
                    </div>
                  </div>
                  <select
                    value={row.status || 'PRESENT'}
                    onChange={(event) => change(person._id, person.personType, 'status', event.target.value)}
                  >
                    {(['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HALF_DAY'] as FacultyStatus[]).map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={row.checkIn || ''}
                    onChange={(event) => change(person._id, person.personType, 'checkIn', event.target.value)}
                  />
                  <input
                    type="time"
                    value={row.checkOut || ''}
                    onChange={(event) => change(person._id, person.personType, 'checkOut', event.target.value)}
                  />
                </div>
              );
            })}
          </div>
          {loading && <div className="attendance-loading">Loading faculty…</div>}
        </section>
      ) : (
        <section className="attendance-history">
          <div className="attendance-history-head">
            <div>
              <small>MY FACULTY ATTENDANCE</small>
              <h2>{history.length} records</h2>
            </div>
            <Clock3 />
          </div>
          {history.map((row: any) => (
            <div className="attendance-history-row" key={row._id}>
              <span className={`history-status ${String(row.status).toLowerCase()}`}>{row.status}</span>
              <div>
                <b>
                  {new Date(row.date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </b>
                <small>
                  {[row.checkIn && `In ${row.checkIn}`, row.checkOut && `Out ${row.checkOut}`]
                    .filter(Boolean)
                    .join(' · ') || 'No time punches'}
                </small>
              </div>
              <p>{row.source || 'MANUAL'}</p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function refName(value: any, items: any[]) {
  const id = typeof value === 'object' && value ? String(value._id) : String(value || '');
  return items.find((item) => String(item._id) === id)?.name || id || 'Class';
}
