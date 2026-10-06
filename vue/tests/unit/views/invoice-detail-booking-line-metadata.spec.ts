/**
 * S152 16c — InvoiceDetail reads a booking line from ``line_items[].metadata``.
 *
 * Core ``InvoiceLineItem.to_dict`` publishes the line's extra data under
 * ``metadata`` (never ``extra_data``) and, for a CUSTOM line, sends the plugin
 * name as ``type`` — so a booking line arrives as ``type: "booking"`` with
 * ``metadata.plugin === "booking"``. Reading ``extra_data`` under a ``CUSTOM``
 * type meant the row link and the "Booking" label never resolved.
 *
 * Faked at the transport: the real host ApiClient runs over an axios adapter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const routerPush = vi.fn();
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { invoiceId: 'inv-booking-1' } }),
  useRouter: () => ({ push: routerPush }),
}));

import InvoiceDetail from '../../../src/views/InvoiceDetail.vue';
import { api } from '@/api';

const API_BASE_URL = '/api/v1';
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const INVOICE_PATH = '/user/invoices/inv-booking-1';

/** ``Invoice.to_dict`` with one booking line exactly as ``InvoiceLineItem.to_dict`` sends it. */
const BOOKING_INVOICE = {
  id: 'inv-booking-1',
  invoice_number: 'BK-0001',
  status: 'PAID',
  amount: '50.00',
  total_amount: '50.00',
  currency: 'EUR',
  line_items: [
    {
      id: 'line-1',
      invoice_id: 'inv-booking-1',
      type: 'booking',
      item_id: 'booking-1',
      description: 'Dr. Smith',
      quantity: 1,
      unit_price: '50.00',
      amount: '50.00',
      net_amount: '50.00',
      tax_amount: '0.00',
      tax_breakdown: [],
      metadata: {
        plugin: 'booking',
        resource_slug: 'dr-smith',
        resource_name: 'Dr. Smith',
        start_at: '2026-10-12T09:00:00',
        end_at: '2026-10-12T09:30:00',
      },
    },
  ],
  metadata: {},
};

function installFakeTransport(routes: Record<string, unknown>): void {
  const transport = (api as unknown as { axiosInstance: AxiosInstance }).axiosInstance;
  transport.defaults.baseURL = API_BASE_URL;
  transport.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const path = config.url ?? '';
    const found = Object.prototype.hasOwnProperty.call(routes, path);
    const status = found ? HTTP_OK : HTTP_NOT_FOUND;
    const response = {
      data: found ? routes[path] : { error: 'Not found' },
      status,
      statusText: String(status),
      headers: {},
      config,
    };
    if (!found) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, {}, response);
    }
    return response;
  };
}

function mountView() {
  return mount(InvoiceDetail, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { RouterLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
    },
  });
}

describe('InvoiceDetail — booking line metadata (S152 16c)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    routerPush.mockClear();
    installFakeTransport({ [INVOICE_PATH]: { invoice: BOOKING_INVOICE } });
  });

  it('links the booking row to its resource from line metadata', async () => {
    const wrapper = mountView();
    await flushPromises();

    const descriptionLink = wrapper.find('tbody .item-description-link');
    expect(descriptionLink.exists()).toBe(true);
    expect(descriptionLink.attributes('href')).toBe('/booking/dr-smith');

    await wrapper.find('tbody tr').trigger('click');
    expect(routerPush).toHaveBeenCalledWith('/booking/dr-smith');
  });

  it('labels the booking line "Booking" in the table and the mobile card', async () => {
    const wrapper = mountView();
    await flushPromises();

    const badges = wrapper.findAll('.type-badge').map((badge) => badge.text());
    expect(badges).toEqual(['Booking', 'Booking']);
  });
});
