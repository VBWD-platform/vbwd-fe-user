/**
 * Booking Schedule Visibility E2E
 *
 * Proves that after a booking is created:
 * 1. The schedule API shows the booked slot with customer name
 * 2. The booked slot has a booking_id (clickable in UI)
 * 3. The booking detail is accessible
 *
 * Uses pure API calls — no admin UI login needed.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const API = `${BASE}/api/v1`;

async function getToken(email: string, password: string): Promise<string> {
  const resp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await resp.json();
  return data.access_token || data.token;
}

function getNextWeekday(targetDay: number): string {
  const now = new Date();
  const daysUntilTarget = (targetDay - now.getDay() + 7) % 7 || 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntilTarget);
  return target.toISOString().split('T')[0];
}

test.describe('Booking visible on Schedule API', () => {
  let userToken: string;
  let adminToken: string;
  let bookingDate: string;
  let resourceId: string;
  let bookingId: string;
  let expectedCustomerName: string;

  test.beforeAll(async () => {
    userToken = await getToken('test@example.com', 'TestPass123@');

    // The schedule shows the booker's profile first name (or their email when
    // the profile has none); other specs edit the shared test user's profile.
    const detailsResp = await fetch(`${API}/user/details`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const details = await detailsResp.json();
    expectedCustomerName = (details.first_name || 'test@example.com').toLowerCase();
    adminToken = await getToken('admin@example.com', 'AdminPass123@');
    bookingDate = getNextWeekday(4); // Next Thursday

    // Get Dr. Smith resource ID
    const resourceResp = await fetch(`${API}/booking/resources/dr-smith`);
    const resource = await resourceResp.json();
    resourceId = resource.id;

    // Create checkout
    const checkoutResp = await fetch(`${API}/booking/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        resource_slug: 'dr-smith',
        start_at: `${bookingDate}T15:00:00`,
        end_at: `${bookingDate}T15:10:00`,
        custom_fields: { symptoms: 'Schedule visibility test' },
      }),
    });
    const checkoutData = await checkoutResp.json();
    console.log(`Checkout: ${checkoutData.invoice_number} on ${bookingDate}`);

    // Mark paid
    await fetch(`${API}/admin/invoices/${checkoutData.invoice_id}/mark-paid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ payment_reference: 'SCHED-TEST', payment_method: 'manual' }),
    });

    // Find the booking
    await new Promise(r => setTimeout(r, 2000));
    const bookingsResp = await fetch(`${API}/admin/booking/bookings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bookings = (await bookingsResp.json()).bookings;
    const match = bookings.find(
      (b: { start_at: string; resource?: { slug: string } }) =>
        b.start_at === `${bookingDate}T15:00:00` && b.resource?.slug === 'dr-smith'
    );
    bookingId = match?.id;
    console.log(`Booking ID: ${bookingId}`);
  });

  test('schedule API shows booked slot with customer name', async () => {
    const resp = await fetch(
      `${API}/admin/booking/resources/${resourceId}/schedule?date_from=${bookingDate}&date_to=${bookingDate}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(resp.status).toBe(200);

    const data = await resp.json();
    const day = data.days[0];
    expect(day.date).toBe(bookingDate);

    // Find booked slots
    const bookedSlots = day.slots.filter(
      (s: { status: string }) => s.status === 'booked'
    );
    console.log(`Booked slots on ${bookingDate}: ${bookedSlots.length}`);
    expect(bookedSlots.length).toBeGreaterThan(0);

    // Check customer name
    const slot = bookedSlots.find(
      (s: { start: string }) => s.start === '15:00'
    );
    expect(slot).toBeTruthy();
    expect(slot.customer_name.toLowerCase()).toContain(expectedCustomerName);
    expect(slot.booking_id).toBe(bookingId);
    expect(slot.booking_status).toBe('confirmed');
    console.log(`Slot 15:00: customer=${slot.customer_name}, status=${slot.booking_status}`);
  });

  test('booking detail accessible via booking_id', async () => {
    expect(bookingId).toBeTruthy();

    const resp = await fetch(
      `${API}/admin/booking/bookings/${bookingId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(resp.status).toBe(200);

    const booking = await resp.json();
    expect(booking.resource?.name).toBe('Dr. Smith');
    expect(booking.status).toBe('confirmed');
    expect(booking.start_at).toBe(`${bookingDate}T15:00:00`);
    console.log(`Booking detail: ${booking.resource?.name}, ${booking.status}`);
  });

  test('booked slot time range matches booking', async () => {
    const resp = await fetch(
      `${API}/admin/booking/resources/${resourceId}/schedule?date_from=${bookingDate}&date_to=${bookingDate}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const data = await resp.json();
    const bookedSlots = data.days[0].slots.filter(
      (s: { status: string; booking_id?: string }) =>
        s.status === 'booked' && s.booking_id === bookingId
    );

    // All slots belonging to this booking should have the same booking_id
    expect(bookedSlots.length).toBeGreaterThan(0);
    for (const slot of bookedSlots) {
      expect(slot.booking_id).toBe(bookingId);
      expect(slot.customer_name).toBeTruthy();
    }
    console.log(`${bookedSlots.length} slot(s) belong to booking ${bookingId?.slice(0, 8)}`);
  });
});
