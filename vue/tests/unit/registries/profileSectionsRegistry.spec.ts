import { describe, it, expect, beforeEach } from 'vitest';
import { defineComponent } from 'vue';
import {
  registerProfileSection,
  getProfileSections,
  _resetProfileSections,
} from '@/registries/profileSectionsRegistry';

const Stub = (id: string) =>
  defineComponent({ name: id, render: () => null });

beforeEach(() => _resetProfileSections());

describe('profileSectionsRegistry', () => {
  it('returns an empty array when nothing is registered', () => {
    expect(getProfileSections()).toEqual([]);
  });

  it('returns sections in ascending order, defaulting to 100', () => {
    registerProfileSection({ id: 'late', component: Stub('A'), order: 200 });
    registerProfileSection({ id: 'mid', component: Stub('B') }); // default 100
    registerProfileSection({ id: 'first', component: Stub('C'), order: 10 });

    const ordered = getProfileSections().map((s) => s.id);
    expect(ordered).toEqual(['first', 'mid', 'late']);
  });

  it('last-write-wins on the same id (plugin override semantics)', () => {
    const first = Stub('A');
    const second = Stub('B');
    registerProfileSection({ id: 'meinchat-nickname', component: first });
    registerProfileSection({ id: 'meinchat-nickname', component: second });

    const sections = getProfileSections();
    expect(sections).toHaveLength(1);
    expect(sections[0].component).toBe(second);
  });

  it('_resetProfileSections clears the registry (test isolation)', () => {
    registerProfileSection({ id: 'meinchat-nickname', component: Stub('A') });
    expect(getProfileSections()).toHaveLength(1);
    _resetProfileSections();
    expect(getProfileSections()).toEqual([]);
  });

  it('filters by placement (default = bottom)', () => {
    registerProfileSection({ id: 'top-section', component: Stub('A'), placement: 'top' });
    registerProfileSection({ id: 'bottom-explicit', component: Stub('B'), placement: 'bottom' });
    registerProfileSection({ id: 'bottom-default', component: Stub('C') });

    expect(getProfileSections('top').map((s) => s.id)).toEqual(['top-section']);
    expect(getProfileSections('bottom').map((s) => s.id).sort()).toEqual(
      ['bottom-default', 'bottom-explicit'],
    );
    // Calling with no arg returns every registered section regardless of placement.
    expect(getProfileSections().length).toBe(3);
  });

  it('sorts within a placement by order then insertion', () => {
    registerProfileSection({ id: 'a', component: Stub('A'), placement: 'top', order: 30 });
    registerProfileSection({ id: 'b', component: Stub('B'), placement: 'top', order: 10 });
    registerProfileSection({ id: 'c', component: Stub('C'), placement: 'top', order: 20 });

    expect(getProfileSections('top').map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });
});
