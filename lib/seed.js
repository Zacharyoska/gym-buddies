'use strict';

const { hashPassword } = require('./auth');
const { transaction } = require('./db');
const {
  todayISO,
  nowStamp,
  addDays,
  diffDays,
  startOfWeekISO,
  nowMinusMinutes
} = require('./dates');
const { AVATAR_COLORS, refreshSubscriptionStatuses } = require('./domain');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function timestampAt(day, hour, minute = 0) {
  return `${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function addMinutesToStamp(stamp, minutes) {
  const date = new Date(stamp.replace(' ', 'T'));
  date.setMinutes(date.getMinutes() + minutes);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

async function clearAll(db) {
  await db.exec(`
    DELETE FROM bookings;
    DELETE FROM checkins;
    DELETE FROM buddy_pairs;
    DELETE FROM payments;
    DELETE FROM subscriptions;
    DELETE FROM classes;
    DELETE FROM members;
    DELETE FROM plans;
    DELETE FROM staff;
    DELETE FROM sqlite_sequence;
  `);
}

async function buildDemo(db) {
  const random = mulberry32(20261118);
  const today = todayISO();
  const now = new Date();
  const randInt = (min, max) => min + Math.floor(random() * (max - min + 1));
  const pick = (items) => items[Math.floor(random() * items.length)];
  const weightedMethod = () => {
    const roll = random();
    if (roll < 0.34) return 'card';
    if (roll < 0.58) return 'cash';
    if (roll < 0.82) return 'online';
    return 'bank';
  };
  const statusFor = (start, end) => {
    if (end < today) return 'expired';
    if (start > today) return 'scheduled';
    return 'active';
  };
  const recordTime = (stamp) => stamp;

  const staff = await db
    .prepare(
      `INSERT INTO staff (username, password_hash, full_name, role, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      'admin',
      hashPassword('admin123'),
      'Carlo Canela',
      'Owner',
      nowStamp()
    );

  const planDefs = [
    {
      name: 'Monthly',
      description: 'Flexible access with the freedom to pause anytime.',
      duration_days: 30,
      price_cents: 150000,
      features: [
        'Unlimited gym access',
        'Locker room access',
        '1 guest pass per month',
        'Free fitness assessment'
      ]
    },
    {
      name: 'Quarterly',
      description: 'Three months of momentum at a friendlier rate.',
      duration_days: 90,
      price_cents: 400000,
      features: [
        'Everything in Monthly',
        '2 guest passes per month',
        '1 personal training session',
        'Priority class booking'
      ]
    },
    {
      name: 'Annual',
      description: 'A full year of accountability, classes, and community.',
      duration_days: 365,
      price_cents: 1400000,
      features: [
        'Everything in Quarterly',
        '4 guest passes per month',
        '3 personal training sessions',
        'Free buddy membership for 1 month'
      ]
    },
    {
      name: 'Student Monthly',
      description: 'Valid student ID required. Same gym, student-friendly price.',
      duration_days: 30,
      price_cents: 100000,
      features: [
        'Unlimited gym access',
        'Locker room access',
        'Off-peak class access',
        'Valid student ID required'
      ]
    },
    {
      name: 'Day Pass',
      description: 'One day of full gym access for visitors.',
      duration_days: 1,
      price_cents: 30000,
      features: ['Full-day gym access', 'Locker room access', 'No commitment']
    }
  ];
  const plans = {};
  for (const plan of planDefs) {
    const result = await db
      .prepare(
        `INSERT INTO plans (name, description, duration_days, price_cents, features, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .run(
        plan.name,
        plan.description,
        plan.duration_days,
        plan.price_cents,
        JSON.stringify(plan.features),
        nowStamp()
      );
    plans[plan.name] = { ...plan, id: Number(result.lastInsertRowid) };
  }
  const membershipPlans = [
    plans.Monthly,
    plans.Monthly,
    plans.Monthly,
    plans.Monthly,
    plans.Quarterly,
    plans.Quarterly,
    plans.Annual,
    plans['Student Monthly'],
    plans.Monthly
  ];

  const names = [
    ['Mika', 'Reyes'],
    ['Paolo', 'Santos'],
    ['Bea', 'Cruz'],
    ['Joshua', 'Dela Cruz'],
    ['Angela', 'Bautista'],
    ['Miguel', 'Torres'],
    ['Camille', 'Garcia'],
    ['Rafael', 'Mendoza'],
    ['Lia', 'Fernandez'],
    ['Daniel', 'Okafor'],
    ['Ava', 'Thompson'],
    ['Noah', 'Williams'],
    ['Isabella', 'Rossi'],
    ['Lucas', 'Silva'],
    ['Amara', 'Nwosu'],
    ['Henry', 'Park'],
    ['Grace', 'Liu'],
    ['Mateo', 'Alvarez'],
    ['Zara', 'Ahmed'],
    ['Ben', 'Carter'],
    ['Elena', 'Petrova'],
    ['Kwame', 'Mensah'],
    ['Ruby', 'Singh'],
    ['Oliver', 'Schmidt'],
    ['Layla', 'Hassan'],
    ['Diego', 'Morales'],
    ['Nina', 'Kowalski'],
    ['Theo', 'Martin'],
    ['Hana', 'Sato'],
    ['Caleb', 'Wright'],
    ['Jasmine', 'Cole'],
    ['Adrian', 'Vega']
  ];

  const scenarios = shuffle(
    [
      ...Array(17).fill('active'),
      ...Array(4).fill('expiring'),
      ...Array(4).fill('expired'),
      ...Array(2).fill('frozen'),
      ...Array(1).fill('scheduled'),
      ...Array(2).fill('no_plan'),
      ...Array(2).fill('inactive')
    ],
    random
  );

  const genders = ['female', 'male', 'non-binary'];
  const memberSpecs = names.map(([firstName, lastName], index) => {
    const scenario = scenarios[index];
    const plan = pick(membershipPlans);
    const subs = [];
    let joinedOn = addDays(today, -randInt(30, 560));

    if (scenario !== 'no_plan') {
      let current;
      if (scenario === 'scheduled') {
        const start = addDays(today, randInt(7, 21));
        const previousEnd = addDays(start, -1);
        const previousStart = addDays(previousEnd, -(plan.duration_days - 1));
        subs.push({
          plan,
          start: previousStart,
          end: previousEnd,
          status: statusFor(previousStart, previousEnd)
        });
        current = {
          plan,
          start,
          end: addDays(start, plan.duration_days - 1),
          status: 'scheduled'
        };
      } else {
        let start;
        let end;
        if (scenario === 'active') {
          const elapsed = randInt(8, Math.max(8, plan.duration_days - 8));
          start = addDays(today, -elapsed);
          end = addDays(start, plan.duration_days - 1);
        } else if (scenario === 'frozen') {
          const elapsed = randInt(3, Math.max(3, plan.duration_days - 8));
          start = addDays(today, -elapsed);
          end = addDays(start, plan.duration_days - 1);
        } else if (scenario === 'expiring') {
          end = addDays(today, randInt(1, 6));
          start = addDays(end, -(plan.duration_days - 1));
        } else if (scenario === 'inactive') {
          end = addDays(today, -randInt(10, 60));
          start = addDays(end, -(plan.duration_days - 1));
        } else {
          end = addDays(today, -randInt(4, 70));
          start = addDays(end, -(plan.duration_days - 1));
        }
        const maxPrevious = plan.duration_days >= 365 ? 1 : plan.duration_days >= 90 ? 2 : 3;
        const previousCount = randInt(0, maxPrevious);
        let cursorEnd = addDays(start, -1);
        for (let i = 0; i < previousCount; i += 1) {
          const previousStart = addDays(cursorEnd, -(plan.duration_days - 1));
          subs.unshift({
            plan,
            start: previousStart,
            end: cursorEnd,
            status: statusFor(previousStart, cursorEnd)
          });
          cursorEnd = addDays(previousStart, -1);
        }
        const status =
          scenario === 'frozen'
            ? 'frozen'
            : scenario === 'inactive'
              ? 'expired'
              : statusFor(start, end);
        current = { plan, start, end, status };
      }
      subs.push(current);
      const earliest = subs.reduce(
        (min, sub) => (sub.start < min ? sub.start : min),
        subs[0].start
      );
      joinedOn = addDays(earliest, -randInt(0, 30));
      if (joinedOn > today) joinedOn = addDays(today, -randInt(1, 20));
    }

    const oldest = subs[0];
    let freezeStarted = null;
    if (scenario === 'frozen') {
      const current = subs[subs.length - 1];
      freezeStarted = addDays(today, -randInt(2, 12));
      if (freezeStarted < current.start) freezeStarted = current.start;
      if (freezeStarted > today) freezeStarted = today;
    }

    const year = randInt(1977, 2005);
    const month = randInt(1, 12);
    const day = randInt(1, 28);
    const phoneSuffix = String(1000 + index * 37).slice(-4);

    return {
      firstName,
      lastName,
      email: `${firstName.toLowerCase().replace(/[^a-z]/g, '')}.${lastName
        .toLowerCase()
        .replace(/[^a-z]/g, '')}@example.com`,
      phone: `+63 917 555 ${phoneSuffix}`,
      dateOfBirth: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      gender: genders[index % genders.length],
      address: `${randInt(12, 980)} ${pick(['Rizal', 'Mabini', 'Katipunan', 'Ortigas', 'Ayala', 'Bonifacio'])} ${pick([
        'St',
        'Ave'
      ])}, ${pick(['Quezon City', 'Makati', 'Pasig', 'Taguig', 'Manila'])}`,
      emergencyName: `${pick(['Ana', 'Jun', 'Lea', 'Rico', 'Mia'])} ${lastName}`,
      emergencyPhone: `+63 917 555 ${String(2000 + index * 29).slice(-4)}`,
      joinedOn,
      scenario,
      status: scenario === 'inactive' ? 'inactive' : 'active',
      notes:
        random() < 0.25
          ? pick([
              'Prefers early morning workouts.',
              'Training for a half marathon in spring.',
              'Interested in personal training.',
              'Usually visits after work.',
              'Referred by a current member.'
            ])
          : null,
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      subs,
      oldest,
      freezeStarted
    };
  });

  const memberRows = [];
  for (let index = 0; index < memberSpecs.length; index += 1) {
    const spec = memberSpecs[index];
    const code = `GB-${String(index + 1).padStart(4, '0')}`;
    const createdAt = nowStamp();
    const result = await db
      .prepare(
        `INSERT INTO members
          (code, first_name, last_name, email, phone, date_of_birth, gender, address,
           emergency_contact_name, emergency_contact_phone, joined_on, status, notes,
           avatar_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        spec.firstName,
        spec.lastName,
        spec.email,
        spec.phone,
        spec.dateOfBirth,
        spec.gender,
        spec.address,
        spec.emergencyName,
        spec.emergencyPhone,
        spec.joinedOn,
        spec.status,
        spec.notes,
        spec.avatarColor,
        createdAt,
        createdAt
      );
    spec.id = Number(result.lastInsertRowid);
    spec.code = code;
    memberRows.push(spec);

    for (const sub of spec.subs) {
      const freezeStart = sub === spec.subs[spec.subs.length - 1] ? spec.freezeStarted : null;
      const resultSub = await db
        .prepare(
          `INSERT INTO subscriptions
            (member_id, plan_id, start_date, end_date, status, price_cents, freeze_started_on, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          spec.id,
          sub.plan.id,
          sub.start,
          sub.end,
          sub.status,
          sub.plan.price_cents,
          freezeStart,
          null,
          `${sub.start} 09:00:00`
        );
      sub.id = Number(resultSub.lastInsertRowid);
    }
  }

  const paymentSpecs = [];
  for (const member of memberRows) {
    for (const sub of member.subs) {
      const paidDay = sub.start <= today ? sub.start : today;
      paymentSpecs.push({
        memberId: member.id,
        subscriptionId: sub.id,
        amountCents: sub.plan.price_cents,
        method: weightedMethod(),
        paidAt: timestampAt(paidDay, randInt(8, 19), randInt(0, 59)),
        description: `${sub.plan.name} membership`,
        status: 'paid'
      });
    }
  }

  const activeMembers = memberRows.filter((member) => member.status === 'active');
  const merchandise = [
    ['Personal training session', 80000],
    ['Protein powder', 120000],
    ['Guest pass', 30000],
    ['Locker rental', 20000],
    ['Gym hoodie', 120000],
    ['Fitness assessment', 50000]
  ];
  for (let i = 0; i < 12; i += 1) {
    const member = pick(activeMembers);
    const [label, amount] = pick(merchandise);
    paymentSpecs.push({
      memberId: member.id,
      subscriptionId: null,
      amountCents: amount,
      method: weightedMethod(),
      paidAt: timestampAt(addDays(today, -randInt(1, 110)), randInt(9, 19), randInt(0, 59)),
      description: label,
      status: i === 4 ? 'refunded' : 'paid'
    });
  }

  paymentSpecs.sort((a, b) => (a.paidAt < b.paidAt ? -1 : a.paidAt > b.paidAt ? 1 : 0));
  let receipt = 10025;
  for (const payment of paymentSpecs) {
    receipt += 1;
    await db.prepare(
      `INSERT INTO payments
        (receipt_no, member_id, subscription_id, amount_cents, method, status, paid_at, description, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `RCPT-${String(receipt).padStart(5, '0')}`,
      payment.memberId,
      payment.subscriptionId,
      payment.amountCents,
      payment.method,
      payment.status,
      recordTime(payment.paidAt),
      payment.description,
      payment.status === 'refunded' ? 'Refunded to original payment method.' : null,
      nowStamp()
    );
  }

  const eligiblePairMembers = shuffle(
    activeMembers.filter((member) =>
      ['active', 'expiring'].includes(member.scenario)
    ),
    random
  ).slice(0, 12);
  const pairSpecs = [];
  for (let i = 0; i + 1 < eligiblePairMembers.length; i += 2) {
    const a = eligiblePairMembers[i];
    const b = eligiblePairMembers[i + 1];
    const low = Math.min(a.id, b.id);
    const high = Math.max(a.id, b.id);
    const goal = randInt(2, 4);
    await db.prepare(
      `INSERT INTO buddy_pairs
        (member_a_id, member_b_id, weekly_goal, status, note, created_at)
       VALUES (?, ?, ?, 'active', ?, ?)`
    ).run(
      low,
      high,
      goal,
      random() < 0.4 ? 'Keeping each other accountable.' : null,
      timestampAt(addDays(today, -randInt(15, 120)), randInt(9, 17), randInt(0, 59))
    );
    pairSpecs.push({ low, high, goal, a, b });
  }

  const coveredOn = (member, day) =>
    member.subs.some(
      (sub) => sub.status !== 'cancelled' && sub.start <= day && sub.end >= day
    );
  const checkinRecords = [];
  const visitedDays = new Set();
  const addCheckin = (member, day, options = {}) => {
    const key = `${member.id}|${day}`;
    if (visitedDays.has(key)) return false;
    visitedDays.add(key);
    const duration = options.duration || randInt(45, 100);
    let checkedIn;
    let checkedOut = null;
    if (options.live) {
      checkedIn = options.checkedIn || nowMinusMinutes(options.minutesAgo || randInt(15, 70));
    } else {
      checkedIn = timestampAt(day, options.hour ?? randInt(6, 20), options.minute ?? randInt(0, 59));
      checkedOut = addMinutesToStamp(checkedIn, duration);
    }
    checkinRecords.push({
      memberId: member.id,
      checkedIn,
      checkedOut,
      source: options.source || 'front_desk',
      note: options.note || null
    });
    return true;
  };

  const historicalMembers = memberRows.filter((member) =>
    ['active', 'expiring', 'frozen', 'expired', 'scheduled'].includes(member.scenario)
  );
  for (const member of historicalMembers) {
    const allowed = [];
    for (let offset = 89; offset >= 1; offset -= 1) {
      const day = addDays(today, -offset);
      if (!coveredOn(member, day)) continue;
      if (member.scenario === 'frozen' && member.freezeStarted && day > member.freezeStarted) {
        continue;
      }
      allowed.push(day);
    }
    const desired =
      member.scenario === 'frozen'
        ? randInt(4, 12)
        : member.scenario === 'expired'
          ? randInt(5, 14)
          : randInt(8, 22);
    for (const day of shuffle(allowed, random).slice(0, desired)) {
      addCheckin(member, day);
    }
  }

  if (now.getHours() >= 10) {
    const todayVisitors = shuffle(
      activeMembers.filter((member) => coveredOn(member, today)),
      random
    ).slice(0, 4);
    for (const member of todayVisitors) {
      const checkedIn = timestampAt(today, randInt(6, 8), randInt(0, 59));
      addCheckin(member, today, {
        hour: Number(checkedIn.slice(11, 13)),
        minute: Number(checkedIn.slice(14, 16)),
        duration: randInt(45, 85)
      });
    }
  }

  for (const pair of pairSpecs) {
    const candidateDays = [];
    for (let offset = 28; offset >= 1; offset -= 1) {
      const day = addDays(today, -offset);
      if (coveredOn(pair.a, day) && coveredOn(pair.b, day)) candidateDays.push(day);
    }
    const chosen = shuffle(candidateDays, random).slice(0, randInt(5, 8));
    const weekStart = startOfWeekISO(today);
    const thisWeekDays = candidateDays
      .filter((day) => day >= weekStart && day <= today)
      .slice(-2);
    for (const day of new Set([...chosen, ...thisWeekDays])) {
      addCheckin(pair.a, day, { hour: 18, minute: randInt(0, 20) });
      addCheckin(pair.b, day, { hour: 18, minute: randInt(25, 50) });
    }
  }

  let liveTarget = 5;
  const liveMembers = shuffle(
    activeMembers.filter((member) => coveredOn(member, today) && !visitedDays.has(`${member.id}|${today}`)),
    random
  );
  for (const member of liveMembers) {
    if (checkinRecords.filter((record) => record.checkedOut === null).length >= liveTarget) break;
    const offset = Math.min(randInt(15, 65), Math.max(5, now.getHours() * 60 + now.getMinutes() - 5));
    addCheckin(member, today, { live: true, minutesAgo: offset });
  }

  for (const record of checkinRecords) {
    await db.prepare(
      `INSERT INTO checkins (member_id, checked_in_at, checked_out_at, source, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      record.memberId,
      record.checkedIn,
      record.checkedOut,
      record.source,
      record.note,
      nowStamp()
    );
  }

  const classTemplates = [
    {
      name: 'Sunrise HIIT',
      coach: 'Mia Santos',
      room: 'Studio A',
      duration: 45,
      description: 'High-intensity intervals to wake up every muscle.'
    },
    {
      name: 'Power Yoga',
      coach: 'Elena Park',
      room: 'Studio B',
      duration: 60,
      description: 'Strength-focused flow for mobility and balance.'
    },
    {
      name: 'Strength Foundations',
      coach: 'Andre Cole',
      room: 'Main Floor',
      duration: 50,
      description: 'Coached barbell basics for every experience level.'
    },
    {
      name: 'Spin & Sweat',
      coach: 'Rina Patel',
      room: 'Cycle Room',
      duration: 45,
      description: 'A beat-driven ride with climbs, sprints, and recovery.'
    },
    {
      name: 'Boxing Basics',
      coach: 'Tomas Reyes',
      room: 'Studio A',
      duration: 45,
      description: 'Footwork, combinations, and conditioning without contact.'
    },
    {
      name: 'Mobility & Recovery',
      coach: 'Elena Park',
      room: 'Studio B',
      duration: 40,
      description: 'Low-impact movement and guided recovery work.'
    },
    {
      name: 'Zumba Blast',
      coach: 'Camila Duarte',
      room: 'Studio A',
      duration: 55,
      description: 'A high-energy dance workout with a community feel.'
    },
    {
      name: 'Core & Abs',
      coach: 'Andre Cole',
      room: 'Main Floor',
      duration: 30,
      description: 'Focused core training that fits into any routine.'
    }
  ];
  const slots = [['06:30', 6], ['09:15', 9], ['12:15', 12], ['17:30', 17], ['18:30', 18], ['19:30', 19]];
  const classRows = [];
  for (let offset = -14; offset <= 21; offset += 1) {
    const day = addDays(today, offset);
    const count = offset === 0 ? 2 : random() < 0.38 ? 2 : 1;
    const daySlots = shuffle(slots, random).slice(0, count);
    if (offset === 0) {
      daySlots[0] = slots[4];
    }
    for (let index = 0; index < daySlots.length; index += 1) {
      const [time, hour] = daySlots[index];
      const template = pick(classTemplates);
      const capacity = randInt(10, 18);
      const startsAt = `${day} ${time}:00`;
      const status = offset === 8 && index === 0 ? 'cancelled' : 'active';
      const result = await db
        .prepare(
          `INSERT INTO classes
            (name, coach, room, starts_at, duration_min, capacity, description, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          template.name,
          template.coach,
          template.room,
          startsAt,
          template.duration,
          capacity,
          template.description,
          status,
          nowStamp()
        );
      const classId = Number(result.lastInsertRowid);
      const startsMs = new Date(startsAt.replace(' ', 'T')).getTime();
      const ended = startsMs + template.duration * 60 * 1000 < now.getTime();
      classRows.push({ id: classId, startsAt, duration: template.duration, capacity, ended, status });
      if (status === 'cancelled') continue;

      const eligible = shuffle(
        activeMembers.filter((member) => coveredOn(member, day)),
        random
      ).slice(0, Math.min(capacity, randInt(2, 9)));
      for (const member of eligible) {
        const bookingStatus = ended
          ? random() < 0.82
            ? 'attended'
            : 'no_show'
          : 'booked';
        await db.prepare(
          `INSERT INTO bookings (class_id, member_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(
          classId,
          member.id,
          bookingStatus,
          timestampAt(addDays(day, -randInt(1, 8)), randInt(8, 20), randInt(0, 59)),
          nowStamp()
        );
      }
    }
  }

  await refreshSubscriptionStatuses(db, today);

  const count = async (table) => Number((await db.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get()).value);
  return {
    staff: await count('staff'),
    plans: await count('plans'),
    members: await count('members'),
    subscriptions: await count('subscriptions'),
    payments: await count('payments'),
    checkins: await count('checkins'),
    classes: await count('classes'),
    bookings: await count('bookings'),
    buddy_pairs: await count('buddy_pairs'),
    demo_login: 'admin / admin123'
  };
}

async function seedDatabase(db, options = {}) {
  const { reset = false } = options;
  const staffCount = Number(
    (await db.prepare('SELECT COUNT(*) AS value FROM staff').get()).value
  );
  const otherData = Number(
    (await db.prepare('SELECT COUNT(*) AS value FROM plans').get()).value
  );
  if (staffCount > 0 && !reset) {
    return { seeded: false };
  }
  const summary = await transaction(db, async () => {
    if (reset || otherData > 0) await clearAll(db);
    return await buildDemo(db);
  });
  return { seeded: true, ...summary };
}

module.exports = { seedDatabase, clearAll };
