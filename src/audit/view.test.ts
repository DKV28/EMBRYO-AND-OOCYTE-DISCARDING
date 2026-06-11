import { describe, it, expect, vi } from 'vitest';
import { setupAuditView } from './view';
import { buildCase, type AuditRecord } from './model';
import type { RawRecord } from '../types';

const rec: RawRecord = {
  fileName: 'ANH.pdf', form: '267', wifeName: 'W', husbandName: 'H',
  wifePID: '2', husbandPID: '1', orDate: new Date(Date.UTC(2025, 5, 9)),
  samples: [{ type: 'Embryo', count: 2 }],
  columns: [
    { location: 'E23G6T', cassetteNo: 1, cassetteColorVi: 'XANH LÁ', tecNo: 1, tecColorVi: 'VÀNG', biopsy: '' },
    { location: 'E25G1G', cassetteNo: 2, cassetteColorVi: 'CAM', tecNo: 2, tecColorVi: 'XANH LÁ', biopsy: '' },
  ],
  warnings: [],
};
const DATE = new Date(Date.UTC(2026, 5, 10));

function clickAll(nodes: NodeListOf<HTMLButtonElement>, val: string) {
  nodes.forEach(b => { if (b.dataset.val === val) b.click(); });
}

describe('audit view (jsdom)', () => {
  it('selects a case, fills the form, and emits a valid record on save', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const saved: AuditRecord[] = [];

    const api = setupAuditView({
      container,
      getCases: () => [buildCase(rec, DATE)],
      getSavedAudit: () => undefined,
      defaultAuditor: () => 'NTV',
      onSave: r => saved.push(r),
      toast: vi.fn(),
    });
    api.refreshCases();

    // pick the case
    const sel = container.querySelector<HTMLSelectElement>('#aCase')!;
    sel.value = 'ANH.pdf';
    sel.dispatchEvent(new Event('change'));

    // sample → Đúng
    const ok = container.querySelector<HTMLInputElement>('input.ok-radio')!;
    ok.checked = true; ok.dispatchEvent(new Event('change'));

    // every Yes/No compliance toggle → YES; every verdict toggle (items + final) → Đạt
    clickAll(container.querySelectorAll('.toggle-yn button'), 'YES');
    clickAll(container.querySelectorAll('.toggle-yn button'), 'Đạt');

    // save
    container.querySelector<HTMLButtonElement>('.btn-submit')!.click();

    expect(saved).toHaveLength(1);
    const r = saved[0];
    expect(r.finalResult).toBe('Đạt');
    expect(r.signatures).toBe('YES');
    expect(r.storageCompliance).toBe('YES');
    expect(r.saveCount).toBe(1);
    expect(r.items).toHaveLength(2);
    expect(r.items[0].verdict).toBe('Đạt');
    expect(r.items[0].fields.location.actual).toBe('E23G6T'); // normalized from expected
    expect(r.items[0].fields.colorCassettes.check).toBe('Đúng');
  });
});
