import { api } from './api.js';
import {
  esc,
  icon,
  money,
  formatDate,
  formatDateTime,
  membershipBadge,
  paymentBadge,
  methodLabel,
  avatar,
  openModal,
  toast
} from './ui.js';

function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function tomorrowAtSix() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}T18:00`;
}

function option(value, label, selected = false) {
  return `<option value="${esc(value)}" ${selected ? 'selected' : ''}>${esc(label)}</option>`;
}

function modalFooter(cancelText, submitText, extra = '') {
  return `<div class="modal-footer ${extra ? 'split' : ''}">
    ${extra}
    <div class="btn-row">
      <button type="button" class="btn btn-ghost" data-dialog-close>${esc(cancelText)}</button>
      <button type="submit" class="btn btn-primary">${esc(submitText)}</button>
    </div>
  </div>`;
}

function memberLabel(member) {
  return `${member.first_name} ${member.last_name} · ${member.code}`;
}

export async function openMemberModal(member = null) {
  const isEdit = Boolean(member);
  const gender = member?.gender || '';
  const genders = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
  if (gender && !genders.includes(gender)) genders.push(gender);

  let plans = [];
  if (!isEdit) {
    try {
      const response = await api.get('/plans');
      plans = response.items.filter((plan) => plan.active);
    } catch (error) {
      toast(error.message, 'error');
      return null;
    }
    if (!plans.length) {
      toast('Create an active plan before adding a member.', 'error');
      return null;
    }
  }

  const membershipFields = isEdit
    ? ''
    : `
      <div class="form-note">
        Choosing a plan creates an active membership with the profile. Check-in unlocks as soon as the
        membership starts — a payment receipt alone does not make someone a gym member.
      </div>
      <div class="form-field span-2">
        <label for="member-plan">Membership plan <span class="required">*</span></label>
        <select class="select" id="member-plan" name="plan_id" required autofocus>
          ${plans
            .map((plan, index) =>
              option(
                plan.id,
                `${plan.name} — ${money(plan.price_cents)} / ${plan.duration_days} day${
                  plan.duration_days === 1 ? '' : 's'
                }`,
                index === 0
              )
            )
            .join('')}
        </select>
      </div>
      <div class="form-field">
        <label for="member-start">Membership starts <span class="required">*</span></label>
        <input class="input" id="member-start" name="start_date" type="date" required
          value="${esc(todayValue())}" />
      </div>
      <div class="form-field">
        <label for="member-pay-method">Payment method</label>
        <select class="select" id="member-pay-method" name="payment_method">
          ${option('card', 'Card', true)}
          ${option('cash', 'Cash')}
          ${option('online', 'Online')}
          ${option('bank', 'Bank transfer')}
        </select>
      </div>
      <div class="form-field span-2">
        <label class="check-row" for="member-record-payment">
          <input type="checkbox" id="member-record-payment" name="record_payment" checked />
          <span>
            <strong>Record the membership payment now</strong>
            <span>The selected plan's price will be saved as a paid receipt.</span>
          </span>
        </label>
      </div>
      <div class="form-field span-2">
        <label for="member-membership-notes">Membership note</label>
        <input class="input" id="member-membership-notes" name="membership_notes" maxlength="500"
          placeholder="Optional note about this membership" />
      </div>
      <div class="form-divider"></div>`;

  const body = `<form class="modal-form" data-form="member" ${
    isEdit ? `data-id="${member.id}"` : ''
  }>
    <div class="modal-body">
      <div class="form-grid">
        ${membershipFields}
        <div class="form-field">
          <label for="member-first">First name <span class="required">*</span></label>
          <input class="input" id="member-first" name="first_name" required maxlength="60"
            ${isEdit ? 'autofocus' : ''}
            value="${esc(member?.first_name || '')}" placeholder="Maya" />
        </div>
        <div class="form-field">
          <label for="member-last">Last name <span class="required">*</span></label>
          <input class="input" id="member-last" name="last_name" required maxlength="60"
            value="${esc(member?.last_name || '')}" placeholder="Chen" />
        </div>
        <div class="form-field">
          <label for="member-email">Email</label>
          <input class="input" id="member-email" name="email" type="email" maxlength="254"
            value="${esc(member?.email || '')}" placeholder="maya@example.com" />
        </div>
        <div class="form-field">
          <label for="member-phone">Phone</label>
          <input class="input" id="member-phone" name="phone" maxlength="40"
            value="${esc(member?.phone || '')}" placeholder="+63 917 555 0100" />
        </div>
        <div class="form-field">
          <label for="member-dob">Date of birth</label>
          <input class="input" id="member-dob" name="date_of_birth" type="date"
            value="${esc(member?.date_of_birth || '')}" />
        </div>
        <div class="form-field">
          <label for="member-gender">Gender</label>
          <select class="select" id="member-gender" name="gender">
            <option value="">Not specified</option>
            ${genders.map((value) => option(value, value, gender === value)).join('')}
          </select>
        </div>
        <div class="form-field span-2">
          <label for="member-address">Address</label>
          <input class="input" id="member-address" name="address" maxlength="300"
            value="${esc(member?.address || '')}" placeholder="Street, city" />
        </div>
        <div class="form-field">
          <label for="member-emergency">Emergency contact</label>
          <input class="input" id="member-emergency" name="emergency_contact_name" maxlength="120"
            value="${esc(member?.emergency_contact_name || '')}" placeholder="Name" />
        </div>
        <div class="form-field">
          <label for="member-emergency-phone">Emergency phone</label>
          <input class="input" id="member-emergency-phone" name="emergency_contact_phone" maxlength="40"
            value="${esc(member?.emergency_contact_phone || '')}" placeholder="+63 917 555 0199" />
        </div>
        <div class="form-field">
          <label for="member-joined">Member since</label>
          <input class="input" id="member-joined" name="joined_on" type="date"
            value="${esc(member?.joined_on || todayValue())}" />
        </div>
        <div class="form-field span-2">
          <label for="member-notes">Notes</label>
          <textarea class="input" id="member-notes" name="notes" maxlength="1000"
            placeholder="Goals, preferences, injuries, or anything the team should know.">${esc(
              member?.notes || ''
            )}</textarea>
        </div>
      </div>
    </div>
    ${modalFooter('Cancel', isEdit ? 'Save changes' : 'Add member')}
  </form>`;
  return openModal({
    title: isEdit ? 'Edit member' : 'Add a new member',
    subtitle: isEdit
      ? `Update ${member.first_name}'s profile. Membership history is kept separately.`
      : 'Choose a plan and create the profile in one step — ready for check-in.',
    size: 'modal-wide',
    body
  });
}

export async function openSubscriptionModal(memberId) {
  let detail;
  let plansResponse;
  try {
    [detail, plansResponse] = await Promise.all([
      api.get(`/members/${memberId}`),
      api.get('/plans')
    ]);
  } catch (error) {
    toast(error.message, 'error');
    return null;
  }
  const plans = plansResponse.items.filter((plan) => plan.active);
  if (!plans.length) {
    toast('Create an active plan before selling a membership.', 'error');
    return null;
  }
  const member = detail.member;
  const current = detail.membership;
  const suggested = detail.suggested_start_date || todayValue();
  const note = current
    ? `Current membership: <strong>${esc(current.plan_name)}</strong> through ${esc(
        formatDate(current.end_date)
      )}. The suggested start date is the day after the latest membership ends.`
    : 'This member does not have a membership yet. Choose a plan and start date.';
  const body = `<form class="modal-form" data-form="subscription" data-id="${memberId}">
    <div class="modal-body">
      <div class="notice" style="margin-bottom:16px">
        ${icon('info')}
        <div>${note}</div>
      </div>
      <div class="form-grid">
        <div class="form-field span-2">
          <label for="sub-plan">Plan <span class="required">*</span></label>
          <select class="select" id="sub-plan" name="plan_id" required autofocus>
            ${plans
              .map((plan, index) =>
                option(
                  plan.id,
                  `${plan.name} — ${money(plan.price_cents)} / ${plan.duration_days} day${
                    plan.duration_days === 1 ? '' : 's'
                  }`,
                  index === 0
                )
              )
              .join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="sub-start">Start date <span class="required">*</span></label>
          <input class="input" id="sub-start" name="start_date" type="date" required
            value="${esc(suggested)}" />
        </div>
        <div class="form-field">
          <label for="sub-method">Payment method</label>
          <select class="select" id="sub-method" name="payment_method">
            ${option('card', 'Card', true)}
            ${option('cash', 'Cash')}
            ${option('online', 'Online')}
            ${option('bank', 'Bank transfer')}
          </select>
        </div>
        <div class="form-field span-2">
          <label class="check-row" for="sub-record">
            <input type="checkbox" id="sub-record" name="record_payment" checked />
            <span>
              <strong>Record the membership payment now</strong>
              <span>The plan price will be recorded as a paid receipt.</span>
            </span>
          </label>
        </div>
        <div class="form-field span-2">
          <label for="sub-notes">Internal note</label>
          <input class="input" id="sub-notes" name="notes" maxlength="500"
            placeholder="Optional note about this membership" />
        </div>
      </div>
    </div>
    ${modalFooter('Cancel', 'Create membership')}
  </form>`;
  return openModal({
    title: `Sell a membership to ${member.first_name}`,
    subtitle: `${member.code} · Choose the plan and when it should begin.`,
    body
  });
}

export async function openPaymentModal({ memberId = null, subscriptionId = null } = {}) {
  let members = [];
  let detail = null;
  try {
    if (memberId) {
      detail = await api.get(`/members/${memberId}`);
    } else {
      const response = await api.get('/members?limit=100&status=all');
      members = response.items;
    }
  } catch (error) {
    toast(error.message, 'error');
    return null;
  }
  const fixedMember = detail?.member || null;
  const currentMembership = detail?.membership || null;
  const subscription = subscriptionId || currentMembership?.id || '';
  const memberField = fixedMember
    ? `<div class="notice" style="margin-bottom:16px">
        ${avatar(fixedMember)}
        <div>
          <strong>${esc(fixedMember.first_name)} ${esc(fixedMember.last_name)}</strong>
          <div class="small muted">${esc(fixedMember.code)}${
            currentMembership
              ? ` · ${esc(currentMembership.plan_name)} membership`
              : ''
          }</div>
        </div>
      </div>
      <input type="hidden" name="member_id" value="${fixedMember.id}" />
      ${subscription ? `<input type="hidden" name="subscription_id" value="${subscription}" />` : ''}`
    : `<div class="form-field span-2">
        <label for="pay-member">Member <span class="required">*</span></label>
        <select class="select" id="pay-member" name="member_id" required autofocus>
          <option value="">Select a member</option>
          ${members
            .map((member) =>
              option(
                member.id,
                `${member.first_name} ${member.last_name} · ${member.code} · ${
                  member.plan_name || 'No plan'
                }`
              )
            )
            .join('')}
        </select>
      </div>`;
  const body = `<form class="modal-form" data-form="payment">
    <div class="modal-body">
      ${memberField}
      <div class="form-grid" style="margin-top:${fixedMember ? '0' : '0'}">
        <div class="form-field">
          <label for="pay-amount">Amount <span class="required">*</span></label>
          <input class="input" id="pay-amount" name="amount" type="number" min="0.01" step="0.01"
            required placeholder="500.00" ${fixedMember ? 'autofocus' : ''} />
        </div>
        <div class="form-field">
          <label for="pay-method">Method <span class="required">*</span></label>
          <select class="select" id="pay-method" name="method">
            ${option('card', 'Card', true)}
            ${option('cash', 'Cash')}
            ${option('online', 'Online')}
            ${option('bank', 'Bank transfer')}
          </select>
        </div>
        <div class="form-field">
          <label for="pay-date">Payment date</label>
          <input class="input" id="pay-date" name="paid_at" type="date" value="${todayValue()}" />
        </div>
        <div class="form-field">
          <label for="pay-description">Description</label>
          <input class="input" id="pay-description" name="description" maxlength="300"
            value="${currentMembership ? esc(`${currentMembership.plan_name} membership`) : ''}"
            placeholder="Membership, personal training, merchandise…" />
        </div>
        <div class="form-field span-2">
          <label for="pay-notes">Notes</label>
          <textarea class="input" id="pay-notes" name="notes" maxlength="500"
            placeholder="Optional note for the receipt."></textarea>
        </div>
        <div class="form-note">
          This creates a paid receipt immediately. Use the refund action on the Payments page if it needs to be reversed.
        </div>
      </div>
    </div>
    ${modalFooter('Cancel', 'Record payment')}
  </form>`;
  return openModal({
    title: 'Record a payment',
    subtitle: fixedMember
      ? 'The payment will be linked to this member and current membership.'
      : 'Record a membership, personal training, or retail payment.',
    body
  });
}

export function openPlanModal(plan = null) {
  const isEdit = Boolean(plan);
  const body = `<form class="modal-form" data-form="plan" ${
    isEdit ? `data-id="${plan.id}"` : ''
  }>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field span-2">
          <label for="plan-name">Plan name <span class="required">*</span></label>
          <input class="input" id="plan-name" name="name" required maxlength="80" autofocus
            value="${esc(plan?.name || '')}" placeholder="Monthly" />
        </div>
        <div class="form-field">
          <label for="plan-price">Price (PHP) <span class="required">*</span></label>
          <input class="input" id="plan-price" name="price" type="number" min="0" step="0.01"
            required value="${esc(plan ? (plan.price_cents / 100).toFixed(2) : '1500.00')}" />
        </div>
        <div class="form-field">
          <label for="plan-duration">Duration (days) <span class="required">*</span></label>
          <input class="input" id="plan-duration" name="duration_days" type="number" min="1"
            max="1095" required value="${esc(plan?.duration_days || 30)}" />
        </div>
        <div class="form-field span-2">
          <label for="plan-description">Description</label>
          <textarea class="input" id="plan-description" name="description" maxlength="600"
            placeholder="A short description shown on the plan card.">${esc(
              plan?.description || ''
            )}</textarea>
        </div>
        <div class="form-field span-2">
          <label for="plan-features">Features</label>
          <textarea class="input" id="plan-features" name="features" maxlength="1200"
            placeholder="One feature per line&#10;Unlimited gym access&#10;Priority class booking">${esc(
              (plan?.features || []).join('\n')
            )}</textarea>
          <span class="hint">Put each feature on its own line.</span>
        </div>
      </div>
    </div>
    ${modalFooter('Cancel', isEdit ? 'Save plan' : 'Create plan')}
  </form>`;
  return openModal({
    title: isEdit ? 'Edit membership plan' : 'Create a membership plan',
    subtitle: 'Plan changes only affect new memberships — existing members keep their terms.',
    body
  });
}

export function openClassModal() {
  const body = `<form class="modal-form" data-form="class">
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field span-2">
          <label for="class-name">Class name <span class="required">*</span></label>
          <input class="input" id="class-name" name="name" required maxlength="100" autofocus
            placeholder="Sunrise HIIT" />
        </div>
        <div class="form-field">
          <label for="class-coach">Coach <span class="required">*</span></label>
          <input class="input" id="class-coach" name="coach" required maxlength="100"
            placeholder="Mia Santos" />
        </div>
        <div class="form-field">
          <label for="class-room">Room</label>
          <input class="input" id="class-room" name="room" maxlength="80" placeholder="Studio A" />
        </div>
        <div class="form-field">
          <label for="class-start">Starts at <span class="required">*</span></label>
          <input class="input" id="class-start" name="starts_at" type="datetime-local" required
            value="${tomorrowAtSix()}" />
        </div>
        <div class="form-field">
          <label for="class-duration">Duration (minutes) <span class="required">*</span></label>
          <input class="input" id="class-duration" name="duration_min" type="number" min="10"
            max="300" required value="45" />
        </div>
        <div class="form-field">
          <label for="class-capacity">Capacity <span class="required">*</span></label>
          <input class="input" id="class-capacity" name="capacity" type="number" min="1" max="100"
            required value="16" />
        </div>
        <div class="form-field span-2">
          <label for="class-description">Description</label>
          <textarea class="input" id="class-description" name="description" maxlength="600"
            placeholder="What should members expect?"></textarea>
        </div>
      </div>
    </div>
    ${modalFooter('Cancel', 'Create session')}
  </form>`;
  return openModal({
    title: 'Add a class session',
    subtitle: 'It will appear on the schedule immediately and members can be booked in.',
    body
  });
}

export async function openBookingModal(classId) {
  let classDetail;
  let membersResponse;
  try {
    [classDetail, membersResponse] = await Promise.all([
      api.get(`/classes/${classId}`),
      api.get('/members?limit=100&status=active')
    ]);
  } catch (error) {
    toast(error.message, 'error');
    return null;
  }
  const gymClass = classDetail.item;
  const bookedIds = new Set(
    classDetail.bookings
      .filter((booking) => booking.status !== 'cancelled')
      .map((booking) => booking.member_id)
  );
  const availableMembers = membersResponse.items.filter((member) => !bookedIds.has(member.id));
  if (gymClass.status === 'cancelled') {
    toast('This class has been cancelled.', 'error');
    return null;
  }
  if (gymClass.ended) {
    toast('This class has already ended.', 'error');
    return null;
  }
  if (classDetail.available <= 0) {
    toast('This class is full.', 'error');
    return null;
  }
  if (!availableMembers.length) {
    toast('Every active member is already booked or unavailable.', 'info');
    return null;
  }
  const body = `<form class="modal-form" data-form="booking" data-id="${classId}">
    <div class="modal-body">
      <div class="notice" style="margin-bottom:16px">
        ${icon('calendar')}
        <div>
          <strong>${esc(gymClass.name)}</strong> · ${esc(formatDateTime(gymClass.starts_at))}<br />
          <span class="small">${classDetail.available} spot${
            classDetail.available === 1 ? '' : 's'
          } left in ${esc(gymClass.room || 'the studio')}.</span>
        </div>
      </div>
      <div class="form-field">
        <label for="booking-member">Member <span class="required">*</span></label>
        <select class="select" id="booking-member" name="member_id" required autofocus>
          <option value="">Select an active member</option>
          ${availableMembers
            .map((member) =>
              option(
                member.id,
                `${member.first_name} ${member.last_name} · ${member.code}${
                  member.plan_name ? ` · ${member.plan_name}` : ''
                }`
              )
            )
            .join('')}
        </select>
        <span class="hint">The member needs a membership that covers the class date.</span>
      </div>
    </div>
    ${modalFooter('Cancel', 'Book member')}
  </form>`;
  return openModal({
    title: 'Book a member into class',
    subtitle: 'Only active members with a valid membership are shown.',
    body
  });
}

export async function openBuddyModal() {
  let response;
  try {
    const [membersResponse, buddiesResponse] = await Promise.all([
      api.get('/members?limit=100&status=active'),
      api.get('/buddies')
    ]);
    response = { members: membersResponse.items, pairs: buddiesResponse.pairs };
  } catch (error) {
    toast(error.message, 'error');
    return null;
  }
  const members = response.members;
  if (members.length < 2) {
    toast('You need at least two active members to create a buddy pair.', 'info');
    return null;
  }
  const options = members
    .map((member) =>
      option(member.id, `${member.first_name} ${member.last_name} · ${member.code}`)
    )
    .join('');
  const body = `<form class="modal-form" data-form="buddy">
    <div class="modal-body">
      <div class="notice" style="margin-bottom:16px">
        ${icon('users')}
        <div>Pairs are accountability partners. Their shared workout days, weekly goal, and streak show up automatically from check-ins.</div>
      </div>
      <div class="form-grid">
        <div class="form-field">
          <label for="buddy-a">Member one <span class="required">*</span></label>
          <select class="select" id="buddy-a" name="member_a_id" required autofocus>
            <option value="">Choose a member</option>
            ${options}
          </select>
        </div>
        <div class="form-field">
          <label for="buddy-b">Member two <span class="required">*</span></label>
          <select class="select" id="buddy-b" name="member_b_id" required>
            <option value="">Choose a member</option>
            ${options}
          </select>
        </div>
        <div class="form-field">
          <label for="buddy-goal">Shared workouts per week</label>
          <select class="select" id="buddy-goal" name="weekly_goal">
            ${[1, 2, 3, 4, 5, 6, 7]
              .map((value) => option(value, `${value} workout${value === 1 ? '' : 's'}`, value === 3))
              .join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="buddy-note">Pair note</label>
          <input class="input" id="buddy-note" name="note" maxlength="300"
            placeholder="e.g. Weekday evenings" />
        </div>
        <div class="form-note">
          Already-paired members can be paired again with someone else. The app will tell you if two members already have an active pair.
        </div>
      </div>
    </div>
    ${modalFooter('Cancel', 'Pair buddies')}
  </form>`;
  return openModal({
    title: 'Pair workout buddies',
    subtitle: 'Create an accountability pair for the Gym Buddies by Jahren & Charles board.',
    body
  });
}

export async function openReceiptModal(paymentId) {
  let response;
  try {
    response = await api.get(`/payments/${paymentId}/receipt`);
  } catch (error) {
    toast(error.message, 'error');
    return null;
  }
  const payment = response.payment;
  const body = `<div class="modal-body">
    <div class="receipt">
      <div class="receipt-top">
        <div class="receipt-brand">
          <div class="receipt-brand-mark"><img src="/images/profile.jpg" alt="" /></div>
          <div>
            <div class="receipt-brand-name">Gym Buddies by Jahren & Charles</div>
            <div class="receipt-brand-sub">Payment receipt</div>
          </div>
        </div>
        <div class="receipt-meta">
          <strong>${esc(payment.receipt_no)}</strong>
          <span>${esc(formatDateTime(payment.paid_at))}</span>
        </div>
      </div>
      <div class="receipt-section">
        <div>
          <div class="receipt-label">Billed to</div>
          <div class="receipt-value">
            ${esc(payment.first_name)} ${esc(payment.last_name)}<br />
            <span class="muted">${esc(payment.code)} · ${esc(payment.email || 'No email on file')}</span>
          </div>
        </div>
        <div>
          <div class="receipt-label">Payment details</div>
          <div class="receipt-value">
            ${esc(payment.description || 'Gym payment')}<br />
            <span class="muted">${esc(methodLabel(payment.method))} · ${paymentBadge(
              payment.status
            ).replace(/class="[^"]*"/g, (match) => match)}</span>
          </div>
        </div>
      </div>
      <div class="receipt-total">
        <span class="receipt-total-label">Amount ${payment.status === 'refunded' ? 'refunded' : 'paid'}</span>
        <span class="receipt-total-value">${money(payment.amount_cents, true)}</span>
      </div>
      <div class="receipt-foot">
        Thank you for choosing Gym Buddies by Jahren & Charles. Questions? Talk to the front desk.<br />
        Generated locally by the front desk system.
      </div>
    </div>
  </div>
  <div class="modal-footer">
    <button type="button" class="btn btn-ghost" data-dialog-close>Close</button>
    <button type="button" class="btn btn-primary" data-action="print-receipt" data-id="${payment.id}">
      ${icon('printer')}<span>Print receipt</span>
    </button>
  </div>`;
  return openModal({
    title: 'Receipt',
    subtitle: 'Printable payment record',
    size: 'modal-narrow',
    body
  });
}

export function getMemberDisplay(member) {
  return member ? `${member.first_name} ${member.last_name}` : '';
}

export { membershipBadge, memberLabel };
