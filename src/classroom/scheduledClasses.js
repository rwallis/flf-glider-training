import { randomUUID } from 'node:crypto';
import { getSessionPackage } from './packages.js';

export const DEFAULT_STUDENT_LIMIT = 10;
export const MAX_STUDENT_LIMIT = 50;

function nowIso() {
  return new Date().toISOString();
}

function displayNameFromUser({ name, email, userKey } = {}) {
  const raw = String(name || '').trim();
  if (raw) return raw.split(/\s+/)[0].slice(0, 24);
  const local = String(email || '').split('@')[0];
  if (local) return local.slice(0, 24);
  const key = String(userKey || '');
  if (!key || key.startsWith('g:') || key.startsWith('e:')) return 'Learner';
  return key.slice(0, 24);
}

function parseLimit(raw, fallback = DEFAULT_STUDENT_LIMIT) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(MAX_STUDENT_LIMIT, Math.floor(n)));
}

function parseStartsAt(raw) {
  if (raw == null || String(raw).trim() === '') {
    const err = new Error('starts_at is required');
    err.status = 400;
    throw err;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const err = new Error('starts_at must be a valid date/time');
    err.status = 400;
    throw err;
  }
  return d.toISOString();
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function classView(row, { enrollments = [], viewerKey = null, includeRoster = false } = {}) {
  const students = enrollments.filter((e) => e.role !== 'instructor');
  const enrolledCount = students.length;
  const studentLimit = Number(row.student_limit) || DEFAULT_STUDENT_LIMIT;
  const full = enrolledCount >= studentLimit;
  const you = viewerKey
    ? enrollments.find((e) => e.user_key === viewerKey) || null
    : null;
  const out = {
    id: row.id,
    package_id: row.package_id,
    title: row.title,
    objective: row.objective || '',
    length_minutes: row.length_minutes ?? null,
    starts_at: row.starts_at,
    student_limit: studentLimit,
    enrolled_count: enrolledCount,
    seats_remaining: Math.max(0, studentLimit - enrolledCount),
    full,
    status: row.status === 'cancelled' ? 'cancelled' : full ? 'full' : 'open',
    created_by: row.created_by,
    created_at: row.created_at,
    instructor_name: row.instructor_name || '',
    you_enrolled: Boolean(you),
    your_role: you?.role || null
  };
  if (includeRoster) {
    out.roster = enrollments.map((e) => ({
      user_key: e.user_key,
      display_name: e.display_name,
      role: e.role,
      enrolled_at: e.enrolled_at,
      remote: Boolean(e.remote)
    }));
  }
  return out;
}

export function createMemoryScheduledClassStore() {
  /** @type {Map<string, any>} */
  const classes = new Map();
  /** @type {Map<string, any[]>} */
  const enrollmentsByClass = new Map();

  return {
    async listClasses({ viewerKey = null, includeCancelled = false } = {}) {
      const rows = [...classes.values()]
        .filter((c) => includeCancelled || c.status !== 'cancelled')
        .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
      return rows.map((row) =>
        classView(row, {
          enrollments: enrollmentsByClass.get(row.id) || [],
          viewerKey
        })
      );
    },

    async getClass(id, { viewerKey = null, includeRoster = false } = {}) {
      const row = classes.get(String(id || ''));
      if (!row) return null;
      return classView(row, {
        enrollments: enrollmentsByClass.get(row.id) || [],
        viewerKey,
        includeRoster
      });
    },

    async schedule({
      packageId,
      startsAt,
      studentLimit,
      instructor
    } = {}) {
      const pkg = await getSessionPackage(packageId);
      if (!pkg) throw httpError(404, 'Class package not found');
      const userKey = String(instructor?.userKey || '').trim();
      if (!userKey) throw httpError(401, 'Instructor identity required');

      const id = randomUUID();
      const row = {
        id,
        package_id: pkg.id,
        title: pkg.title,
        objective: pkg.objective || '',
        length_minutes: pkg.length_minutes ?? null,
        starts_at: parseStartsAt(startsAt),
        student_limit: parseLimit(studentLimit, pkg.max_students || DEFAULT_STUDENT_LIMIT),
        status: 'open',
        created_by: userKey,
        created_at: nowIso(),
        instructor_name: displayNameFromUser(instructor)
      };
      classes.set(id, row);
      enrollmentsByClass.set(id, [
        {
          user_key: userKey,
          display_name: displayNameFromUser(instructor),
          role: 'instructor',
          enrolled_at: nowIso(),
          remote: false
        }
      ]);
      return classView(row, {
        enrollments: enrollmentsByClass.get(id),
        viewerKey: userKey,
        includeRoster: true
      });
    },

    async enroll(classId, user, { remote = false } = {}) {
      const row = classes.get(String(classId || ''));
      if (!row || row.status === 'cancelled') throw httpError(404, 'Scheduled class not found');
      const userKey = String(user?.userKey || '').trim();
      if (!userKey) throw httpError(401, 'Sign in required to enroll');

      const list = enrollmentsByClass.get(row.id) || [];
      const existing = list.find((e) => e.user_key === userKey);
      if (existing) {
        existing.remote = Boolean(remote);
        return classView(row, { enrollments: list, viewerKey: userKey, includeRoster: true });
      }

      const studentCount = list.filter((e) => e.role !== 'instructor').length;
      if (studentCount >= row.student_limit) {
        throw httpError(403, 'This class is full');
      }

      list.push({
        user_key: userKey,
        display_name: displayNameFromUser(user),
        role: row.created_by === userKey ? 'instructor' : 'student',
        enrolled_at: nowIso(),
        remote: Boolean(remote)
      });
      enrollmentsByClass.set(row.id, list);
      return classView(row, { enrollments: list, viewerKey: userKey, includeRoster: true });
    },

    async cancel(classId, userKey, { isAdmin = false } = {}) {
      const row = classes.get(String(classId || ''));
      if (!row) throw httpError(404, 'Scheduled class not found');
      if (!isAdmin && row.created_by !== userKey) {
        throw httpError(403, 'Only the scheduling instructor can cancel this class');
      }
      row.status = 'cancelled';
      return classView(row, {
        enrollments: enrollmentsByClass.get(row.id) || [],
        viewerKey: userKey,
        includeRoster: true
      });
    }
  };
}

export function createPgScheduledClassStore(db) {
  async function loadEnrollments(classId) {
    const { rows } = await db.query(
      `SELECT user_key, display_name, role, enrolled_at, remote
       FROM glider_class_enrollments
       WHERE class_id = $1
       ORDER BY enrolled_at ASC`,
      [classId]
    );
    return rows.map((r) => ({
      user_key: r.user_key,
      display_name: r.display_name,
      role: r.role,
      enrolled_at: r.enrolled_at?.toISOString?.() || String(r.enrolled_at),
      remote: Boolean(r.remote)
    }));
  }

  function mapRow(row) {
    return {
      id: row.id,
      package_id: row.package_id,
      title: row.title,
      objective: row.objective || '',
      length_minutes: row.length_minutes,
      starts_at: row.starts_at?.toISOString?.() || String(row.starts_at),
      student_limit: row.student_limit,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at?.toISOString?.() || String(row.created_at),
      instructor_name: row.instructor_name || ''
    };
  }

  return {
    async listClasses({ viewerKey = null, includeCancelled = false } = {}) {
      const { rows } = await db.query(
        `SELECT *
         FROM glider_scheduled_classes
         WHERE ($1::boolean OR status <> 'cancelled')
         ORDER BY starts_at ASC`,
        [Boolean(includeCancelled)]
      );
      const out = [];
      for (const row of rows) {
        const enrollments = await loadEnrollments(row.id);
        out.push(classView(mapRow(row), { enrollments, viewerKey }));
      }
      return out;
    },

    async getClass(id, { viewerKey = null, includeRoster = false } = {}) {
      const { rows } = await db.query(`SELECT * FROM glider_scheduled_classes WHERE id = $1`, [
        String(id || '')
      ]);
      if (!rows[0]) return null;
      const enrollments = await loadEnrollments(rows[0].id);
      return classView(mapRow(rows[0]), { enrollments, viewerKey, includeRoster });
    },

    async schedule({ packageId, startsAt, studentLimit, instructor } = {}) {
      const pkg = await getSessionPackage(packageId);
      if (!pkg) throw httpError(404, 'Class package not found');
      const userKey = String(instructor?.userKey || '').trim();
      if (!userKey) throw httpError(401, 'Instructor identity required');
      const id = randomUUID();
      const starts = parseStartsAt(startsAt);
      const limit = parseLimit(studentLimit, pkg.max_students || DEFAULT_STUDENT_LIMIT);
      const instructorName = displayNameFromUser(instructor);

      await db.query(
        `INSERT INTO glider_scheduled_classes
          (id, package_id, title, objective, length_minutes, starts_at, student_limit, status, created_by, instructor_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9)`,
        [
          id,
          pkg.id,
          pkg.title,
          pkg.objective || '',
          pkg.length_minutes ?? null,
          starts,
          limit,
          userKey,
          instructorName
        ]
      );
      await db.query(
        `INSERT INTO glider_class_enrollments
          (class_id, user_key, display_name, role, remote)
         VALUES ($1,$2,$3,'instructor', false)`,
        [id, userKey, instructorName]
      );
      return this.getClass(id, { viewerKey: userKey, includeRoster: true });
    },

    async enroll(classId, user, { remote = false } = {}) {
      const { rows } = await db.query(`SELECT * FROM glider_scheduled_classes WHERE id = $1`, [
        String(classId || '')
      ]);
      const row = rows[0];
      if (!row || row.status === 'cancelled') throw httpError(404, 'Scheduled class not found');
      const userKey = String(user?.userKey || '').trim();
      if (!userKey) throw httpError(401, 'Sign in required to enroll');

      const existing = await db.query(
        `SELECT 1 FROM glider_class_enrollments WHERE class_id = $1 AND user_key = $2`,
        [row.id, userKey]
      );
      if (existing.rowCount) {
        await db.query(
          `UPDATE glider_class_enrollments SET remote = $3
           WHERE class_id = $1 AND user_key = $2`,
          [row.id, userKey, Boolean(remote)]
        );
        return this.getClass(row.id, { viewerKey: userKey, includeRoster: true });
      }

      const countRes = await db.query(
        `SELECT count(*)::int AS n FROM glider_class_enrollments
         WHERE class_id = $1 AND role <> 'instructor'`,
        [row.id]
      );
      if ((countRes.rows[0]?.n || 0) >= row.student_limit) {
        throw httpError(403, 'This class is full');
      }

      await db.query(
        `INSERT INTO glider_class_enrollments
          (class_id, user_key, display_name, role, remote)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          row.id,
          userKey,
          displayNameFromUser(user),
          row.created_by === userKey ? 'instructor' : 'student',
          Boolean(remote)
        ]
      );
      return this.getClass(row.id, { viewerKey: userKey, includeRoster: true });
    },

    async cancel(classId, userKey, { isAdmin = false } = {}) {
      const current = await this.getClass(classId, { viewerKey: userKey, includeRoster: true });
      if (!current) throw httpError(404, 'Scheduled class not found');
      if (!isAdmin && current.created_by !== userKey) {
        throw httpError(403, 'Only the scheduling instructor can cancel this class');
      }
      await db.query(
        `UPDATE glider_scheduled_classes SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [classId]
      );
      return this.getClass(classId, { viewerKey: userKey, includeRoster: true });
    }
  };
}

export async function createScheduledClassStore(db) {
  if (db) return createPgScheduledClassStore(db);
  return createMemoryScheduledClassStore();
}
