'use strict';

const { HttpError } = require('../errors');
const validate = require('../validate');
const { nowStamp, todayISO } = require('../dates');

function classEnded(row) {
  const start = new Date(String(row.starts_at).replace(' ', 'T')).getTime();
  return start + Number(row.duration_min) * 60 * 1000 < Date.now();
}

async function bookingCounts(db, classId) {
  return await db
    .prepare(
      `SELECT
         COUNT(CASE WHEN status != 'cancelled' THEN 1 END) AS booked,
         COUNT(CASE WHEN status = 'attended' THEN 1 END) AS attended,
         COUNT(CASE WHEN status = 'no_show' THEN 1 END) AS no_shows
       FROM bookings WHERE class_id = ?`
    )
    .get(classId);
}

async function serializeClass(db, row) {
  const counts = await bookingCounts(db, row.id);
  return {
    ...row,
    booked: Number(counts.booked || 0),
    attended: Number(counts.attended || 0),
    no_shows: Number(counts.no_shows || 0),
    ended: classEnded(row)
  };
}

function register(router) {
  router.add('GET', '/api/classes', async (ctx) => {
    const db = ctx.db;
    const scope = ['upcoming', 'past', 'all'].includes(ctx.query.scope)
      ? ctx.query.scope
      : 'upcoming';
    const now = nowStamp();
    const filters = [];
    const params = [];
    if (scope === 'upcoming') {
      filters.push(`datetime(c.starts_at, '+' || c.duration_min || ' minutes') >= ?`);
      params.push(now);
    } else if (scope === 'past') {
      filters.push(`datetime(c.starts_at, '+' || c.duration_min || ' minutes') < ?`);
      params.push(now);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const order = scope === 'past' ? 'DESC' : 'ASC';
    const rows = await db
      .prepare(
        `SELECT c.* FROM classes c ${where}
         ORDER BY c.starts_at ${order}
         LIMIT 100`
      )
      .all(...params);
    return {
      scope,
      items: await Promise.all(rows.map((row) => serializeClass(db, row))),
      now
    };
  });

  router.add('POST', '/api/classes', async (ctx) => {
    const db = ctx.db;
    const fields = {
      name: validate.string(ctx.body.name, 'Class name', { max: 100 }),
      coach: validate.string(ctx.body.coach, 'Coach', { max: 100 }),
      room: validate.optionalString(ctx.body.room, 'Room', 80),
      starts_at: validate.timestamp(ctx.body.starts_at, 'Start time'),
      duration_min: validate.integer(ctx.body.duration_min, 'Duration', { min: 10, max: 300 }),
      capacity: validate.integer(ctx.body.capacity, 'Capacity', { min: 1, max: 100 }),
      description: validate.optionalString(ctx.body.description, 'Description', 600)
    };
    const result = await db
      .prepare(
        `INSERT INTO classes (name, coach, room, starts_at, duration_min, capacity, description, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`
      )
      .run(
        fields.name,
        fields.coach,
        fields.room || null,
        fields.starts_at,
        fields.duration_min,
        fields.capacity,
        fields.description || null,
        nowStamp()
      );
    ctx.statusCode = 201;
    return await serializeClass(
      db,
      await db.prepare('SELECT * FROM classes WHERE id = ?').get(Number(result.lastInsertRowid))
    );
  });

  router.add('GET', '/api/classes/:id', async (ctx) => {
    const db = ctx.db;
    const classId = validate.id(ctx.params.id, 'Class ID');
    const gymClass = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!gymClass) throw new HttpError(404, 'Class not found.');
    const bookings = await db
      .prepare(
        `SELECT b.id, b.status, b.created_at, b.updated_at,
                m.id AS member_id, m.code, m.first_name, m.last_name,
                m.email, m.phone, m.avatar_color
         FROM bookings b JOIN members m ON m.id = b.member_id
         WHERE b.class_id = ?
         ORDER BY b.created_at ASC`
      )
      .all(classId);
    return {
      item: await serializeClass(db, gymClass),
      bookings,
      available: Math.max(
        0,
        gymClass.capacity - Number((await bookingCounts(db, classId)).booked || 0)
      )
    };
  });

  router.add('PATCH', '/api/classes/:id', async (ctx) => {
    const db = ctx.db;
    const classId = validate.id(ctx.params.id, 'Class ID');
    const existing = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!existing) throw new HttpError(404, 'Class not found.');
    const fields = {
      name:
        ctx.body.name !== undefined
          ? validate.string(ctx.body.name, 'Class name', { max: 100 })
          : existing.name,
      coach:
        ctx.body.coach !== undefined
          ? validate.string(ctx.body.coach, 'Coach', { max: 100 })
          : existing.coach,
      room:
        ctx.body.room !== undefined
          ? validate.optionalString(ctx.body.room, 'Room', 80)
          : existing.room,
      starts_at:
        ctx.body.starts_at !== undefined
          ? validate.timestamp(ctx.body.starts_at, 'Start time')
          : existing.starts_at,
      duration_min:
        ctx.body.duration_min !== undefined
          ? validate.integer(ctx.body.duration_min, 'Duration', { min: 10, max: 300 })
          : existing.duration_min,
      capacity:
        ctx.body.capacity !== undefined
          ? validate.integer(ctx.body.capacity, 'Capacity', { min: 1, max: 100 })
          : existing.capacity,
      description:
        ctx.body.description !== undefined
          ? validate.optionalString(ctx.body.description, 'Description', 600)
          : existing.description,
      status:
        ctx.body.status !== undefined
          ? validate.enumOf(ctx.body.status, ['active', 'cancelled'], 'Status')
          : existing.status
    };
    await db.prepare(
      `UPDATE classes SET name = ?, coach = ?, room = ?, starts_at = ?, duration_min = ?,
        capacity = ?, description = ?, status = ? WHERE id = ?`
    ).run(
      fields.name,
      fields.coach,
      fields.room || null,
      fields.starts_at,
      fields.duration_min,
      fields.capacity,
      fields.description || null,
      fields.status,
      classId
    );
    return await serializeClass(db, await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId));
  });

  router.add('POST', '/api/classes/:id/bookings', async (ctx) => {
    const db = ctx.db;
    const classId = validate.id(ctx.params.id, 'Class ID');
    const memberId = validate.id(ctx.body.member_id, 'Member');
    const gymClass = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!gymClass) throw new HttpError(404, 'Class not found.');
    if (gymClass.status !== 'active') throw new HttpError(409, 'This class has been cancelled.');
    if (gymClass.starts_at <= nowStamp()) {
      throw new HttpError(409, 'This class has already started. Booking is closed.');
    }
    const member = await db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    if (!member) throw new HttpError(404, 'Member not found.');
    if (member.status !== 'active') throw new HttpError(409, 'This member is inactive.');
    const classDate = String(gymClass.starts_at).slice(0, 10);
    const membership = await db
      .prepare(
        `SELECT * FROM subscriptions
         WHERE member_id = ? AND status IN ('active', 'scheduled')
           AND start_date <= ? AND end_date >= ?
         ORDER BY end_date DESC LIMIT 1`
      )
      .get(memberId, classDate, classDate);
    if (!membership) {
      throw new HttpError(403, 'This member needs a membership covering the class date.');
    }
    const count = Number(
      await db
        .prepare(
          `SELECT COUNT(*) AS value FROM bookings
           WHERE class_id = ? AND status != 'cancelled'`
        )
        .get(classId).value
    );
    if (count >= gymClass.capacity) throw new HttpError(409, 'This class is full.');
    const existing = await db
      .prepare('SELECT * FROM bookings WHERE class_id = ? AND member_id = ?')
      .get(classId, memberId);
    if (existing && existing.status !== 'cancelled') {
      throw new HttpError(409, 'This member is already booked into the class.');
    }
    const now = nowStamp();
    let booking;
    if (existing) {
      await db.prepare(
        `UPDATE bookings SET status = 'booked', created_at = ?, updated_at = ? WHERE id = ?`
      ).run(now, now, existing.id);
      booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(existing.id);
    } else {
      const result = await db
        .prepare(
          `INSERT INTO bookings (class_id, member_id, status, created_at, updated_at)
           VALUES (?, ?, 'booked', ?, ?)`
        )
        .run(classId, memberId, now, now);
      booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(result.lastInsertRowid));
    }
    ctx.statusCode = 201;
    return { booking, member };
  });

  router.add('POST', '/api/bookings/:id/status', async (ctx) => {
    const db = ctx.db;
    const bookingId = validate.id(ctx.params.id, 'Booking ID');
    const status = validate.enumOf(
      ctx.body.status,
      ['booked', 'attended', 'no_show', 'cancelled'],
      'Booking status'
    );
    const booking = await db
      .prepare(
        `SELECT b.*, c.capacity, c.starts_at
         FROM bookings b JOIN classes c ON c.id = b.class_id
         WHERE b.id = ?`
      )
      .get(bookingId);
    if (!booking) throw new HttpError(404, 'Booking not found.');
    if (status === 'booked' && booking.status === 'cancelled') {
      const count = Number(
        await db
          .prepare(
            `SELECT COUNT(*) AS value FROM bookings
             WHERE class_id = ? AND status != 'cancelled'`
          )
          .get(booking.class_id).value
      );
      if (count >= booking.capacity) throw new HttpError(409, 'This class is full.');
    }
    await db.prepare(
      `UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?`
    ).run(status, nowStamp(), bookingId);
    return { booking: await db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) };
  });
}

module.exports = { register };
