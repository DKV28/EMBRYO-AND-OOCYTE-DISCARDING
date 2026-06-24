import {
  ITEM_FIELDS, FIELD_LABELS, blankAudit, validateAudit, normalizeItem, emptyItem,
  type AuditCase, type AuditRecord, type AuditItem, type YesNo, type Verdict,
} from './model';

export interface AuditViewOptions {
  container: HTMLElement;
  getCases: () => AuditCase[];
  getSavedAudit: (caseKey: string) => AuditRecord | undefined;
  defaultAuditor: () => string;
  onSave: (record: AuditRecord) => void;
  toast: (msg: string, type: 'success' | 'error') => void;
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

const TOGGLES: { key: keyof AuditRecord; label: string }[] = [
  { key: 'signatures', label: 'Consent Signatures' },
  { key: 'cfCompliance', label: 'CF Compliance' },
  { key: 'storageCompliance', label: 'Storage Compliance' },
  { key: 'discardingProc', label: 'Discarding Procedure' },
];

export function setupAuditView(opts: AuditViewOptions): { refreshCases: () => void } {
  const { container } = opts;
  let current: AuditRecord | null = null;
  let currentCase: AuditCase | null = null;

  container.innerHTML = `
    <div class="card">
      <div class="card-title">Auditor & Patient</div>
      <div class="field"><label>Auditor</label><input type="text" id="aAuditor" placeholder="Tên auditor..."></div>
      <div class="field"><label>Chọn ca (tên · PID · OR Date)</label><select id="aCase"></select></div>
    </div>
    <div id="aForm"></div>`;

  const auditorInput = container.querySelector<HTMLInputElement>('#aAuditor')!;
  const caseSelect = container.querySelector<HTMLSelectElement>('#aCase')!;
  const form = container.querySelector<HTMLDivElement>('#aForm')!;

  auditorInput.value = opts.defaultAuditor();
  auditorInput.addEventListener('input', () => { if (current) current.auditor = auditorInput.value; });

  function refreshCases() {
    const cases = opts.getCases();
    const keep = caseSelect.value;
    caseSelect.innerHTML = '<option value="">— Chọn ca —</option>'
      + cases.map(c => `<option value="${esc(c.key)}">${esc(c.label)}</option>`).join('');
    if (cases.some(c => c.key === keep)) caseSelect.value = keep;
    else { current = null; currentCase = null; form.innerHTML = ''; }
  }

  caseSelect.addEventListener('change', () => selectCase(caseSelect.value));

  function selectCase(key: string) {
    const c = opts.getCases().find(x => x.key === key) || null;
    currentCase = c;
    if (!c) { current = null; form.innerHTML = ''; return; }
    const saved = opts.getSavedAudit(key);
    current = saved ? structuredClone(saved) : blankAudit(c, auditorInput.value || opts.defaultAuditor());
    auditorInput.value = current.auditor || opts.defaultAuditor();
    renderForm();
  }

  function renderForm() {
    if (!current) { form.innerHTML = ''; return; }
    form.innerHTML = '';
    form.append(sampleCard(), complianceCard(), itemsCard(), finalCard(), saveButton());
  }

  // --- Sample checklist ---
  function sampleCard(): HTMLElement {
    const card = el(`<div class="card"><div class="card-title">Sample Checklist</div></div>`);
    const row = checkRow({
      title: 'Sample',
      expected: current!.expectedSample,
      check: current!.sampleCheck,
      actual: current!.actualSample,
      note: current!.sampleNote,
      actualPlaceholder: 'Embryo / Oocyte / Sperm',
      onCheck: v => { current!.sampleCheck = v; },
      onActual: v => { current!.actualSample = v; },
      onNote: v => { current!.sampleNote = v; },
    });
    card.append(row);
    // Sperm bank code check — only for sperm cases that carry a bank code.
    if (current!.bank.expected) {
      card.append(checkRow({
        title: 'Sperm bank code',
        expected: current!.bank.expected,
        check: current!.bank.check,
        actual: current!.bank.actual,
        note: current!.bank.note,
        actualPlaceholder: 'Mã NHTT thực tế',
        onCheck: v => { current!.bank.check = v; },
        onActual: v => { current!.bank.actual = v; },
        onNote: v => { current!.bank.note = v; },
      }));
    }
    return card;
  }

  // --- Compliance ---
  function complianceCard(): HTMLElement {
    const card = el(`<div class="card"><div class="card-title">Compliance</div></div>`);
    const grid = el(`<div class="audit-grid"></div>`);
    for (const t of TOGGLES) {
      const field = el(`<div class="field"><label>${esc(t.label)}</label></div>`);
      field.append(yesNoToggle(current![t.key] as YesNo, v => { (current as any)[t.key] = v; }));
      grid.append(field);
    }
    card.append(grid);
    const notes = el<HTMLDivElement>(`<div class="field"><label>Compliance Notes</label><textarea placeholder="Ghi chú thêm..."></textarea></div>`);
    const ta = notes.querySelector('textarea')!;
    ta.value = current!.complianceNotes;
    ta.addEventListener('input', () => { current!.complianceNotes = ta.value; });
    card.append(notes);
    return card;
  }

  // --- Cassette & Tec items ---
  function itemsCard(): HTMLElement {
    const card = el(`<div class="card"><div class="card-title">Cassette & Tec Checklist</div><div class="audit-items"></div></div>`);
    const list = card.querySelector<HTMLDivElement>('.audit-items')!;
    const draw = () => {
      list.innerHTML = '';
      if (!current!.items.length) {
        list.append(el(`<div class="expected-box">Không có item đối chiếu. Có thể thêm item phát sinh.</div>`));
      }
      current!.items.forEach((it, i) => list.append(itemCard(it, i)));
    };
    draw();
    const add = el<HTMLButtonElement>(`<button class="add-btn" type="button">+ Thêm item phát sinh</button>`);
    add.addEventListener('click', () => {
      current!.items.push(emptyItem(current!.items.length + 1));
      draw();
    });
    card.append(add);
    return card;
  }

  function itemCard(item: AuditItem, idx: number): HTMLElement {
    const phat = item.itemType === 'Phát sinh';
    const card = el(`<div class="item-card"></div>`);
    const head = el(`<div class="item-head"><div class="item-title">Item ${idx + 1} · ${esc(item.itemType)}</div></div>`);
    if (phat) {
      const rm = el<HTMLButtonElement>(`<button class="icon-btn" type="button">×</button>`);
      rm.addEventListener('click', () => { current!.items.splice(idx, 1); renderForm(); });
      head.append(rm);
    }
    card.append(head);

    const checks = el(`<div class="field-checks"></div>`);
    for (const f of ITEM_FIELDS) {
      checks.append(checkRow({
        title: FIELD_LABELS[f],
        expected: item.fields[f].expected,
        actual: item.fields[f].actual || (phat ? '' : item.fields[f].expected),
        note: item.fields[f].note,
        withCheck: false,
        onActual: v => { item.fields[f].actual = v; },
        onNote: v => { item.fields[f].note = v; },
      }));
    }

    if (phat) {
      card.classList.add('is-fail');
      card.append(checks);
    } else {
      const ref = el(`<div class="ref-box">Kỳ vọng: <b>${esc(refLine(item))}</b></div>`);
      const verdictWrap = el(`<div class="item-verdict"></div>`);
      verdictWrap.append(verdictToggle(item.verdict, v => setVerdict(card, item, v)));
      verdictWrap.append(el(`<div class="verdict-hint"></div>`));
      card.append(ref, verdictWrap, checks);
      setVerdict(card, item, item.verdict);
    }
    return card;
  }

  function setVerdict(card: HTMLElement, item: AuditItem, v: Verdict) {
    item.verdict = v;
    card.classList.toggle('is-pass', v === 'Đạt');
    card.classList.toggle('is-fail', v === 'Không đạt');
  }

  // --- Final result ---
  function finalCard(): HTMLElement {
    const card = el(`<div class="card"><div class="card-title">Final Result</div></div>`);
    const field = el(`<div class="field"><label>Kết luận</label></div>`);
    field.append(verdictToggle(current!.finalResult, v => { current!.finalResult = v; }));
    card.append(field);
    return card;
  }

  function saveButton(): HTMLElement {
    const btn = el<HTMLButtonElement>(`<button class="btn-submit" type="button">LƯU</button>`);
    btn.addEventListener('click', () => {
      if (!current || !currentCase) return;
      const err = validateAudit(current);
      if (err) { opts.toast(err, 'error'); return; }
      current.items.forEach(normalizeItem);
      const prev = opts.getSavedAudit(current.caseKey);
      current.saveCount = (prev?.saveCount ?? 0) + 1;
      current.timestamp = new Date().toLocaleString('vi-VN');
      current.auditor = auditorInput.value.trim() || opts.defaultAuditor();
      opts.onSave(structuredClone(current));
      opts.toast(`Đã lưu audit (lần ${current.saveCount})`, 'success');
      selectCase(current.caseKey);     // reload saved copy
    });
    return btn;
  }

  // --- Reusable controls ---
  let rid = 0;
  interface CheckRowOpts {
    title: string; expected: string; actual: string; note: string;
    check?: '' | 'Đúng' | 'Sai'; withCheck?: boolean; actualPlaceholder?: string;
    onCheck?: (v: '' | 'Đúng' | 'Sai') => void;
    onActual: (v: string) => void; onNote: (v: string) => void;
  }
  function checkRow(o: CheckRowOpts): HTMLElement {
    const id = `r${rid++}`;
    const withCheck = o.withCheck !== false;
    const row = el(`
      <div class="check-row${withCheck ? '' : ' no-check'}" data-key="${esc(o.title)}">
        <div class="check-head">
          <div class="check-title">${esc(o.title)}</div>
          <div class="expected-box">${esc(o.expected || '(trống)')}</div>
          ${withCheck ? `<div class="yn-group">
            <input id="${id}ok" type="radio" class="ok-radio" name="${id}" value="Đúng"><label for="${id}ok">Đúng</label>
            <input id="${id}bad" type="radio" class="bad-radio" name="${id}" value="Sai"><label for="${id}bad">Sai</label>
          </div>` : ''}
        </div>
        <div class="actual-wrap">
          <div class="field"><label>Actual value</label><input type="text" class="actual-input" placeholder="${esc(o.actualPlaceholder || 'Giá trị thực tế')}"></div>
          <div class="field"><label>Note</label><input type="text" class="note-input" placeholder="Ghi chú optional"></div>
        </div>
      </div>`);
    const actual = row.querySelector<HTMLInputElement>('.actual-input')!;
    const note = row.querySelector<HTMLInputElement>('.note-input')!;
    actual.value = o.actual; note.value = o.note;
    actual.addEventListener('input', () => o.onActual(actual.value.trim()));
    note.addEventListener('input', () => o.onNote(note.value.trim()));
    if (withCheck) {
      const setBad = (bad: boolean) => row.classList.toggle('is-bad', bad);
      row.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach(r => {
        if (r.value === o.check) r.checked = true;
        r.addEventListener('change', () => { o.onCheck?.(r.value as 'Đúng' | 'Sai'); setBad(r.value === 'Sai'); });
      });
      setBad(o.check === 'Sai');
    }
    return row;
  }

  function yesNoToggle(value: YesNo, onChange: (v: YesNo) => void): HTMLElement {
    const wrap = el(`<div class="toggle-yn"><button type="button" data-val="YES">YES</button><button type="button" data-val="NO">NO</button></div>`);
    const restyle = (v: YesNo) => wrap.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
      b.classList.remove('sel-yes', 'sel-no');
      if (b.dataset.val === v) b.classList.add(v === 'YES' ? 'sel-yes' : 'sel-no');
    });
    wrap.querySelectorAll<HTMLButtonElement>('button').forEach(b =>
      b.addEventListener('click', () => { onChange(b.dataset.val as YesNo); restyle(b.dataset.val as YesNo); }));
    restyle(value);
    return wrap;
  }

  function verdictToggle(value: Verdict, onChange: (v: Verdict) => void): HTMLElement {
    const wrap = el(`<div class="toggle-yn"><button type="button" data-val="Đạt">Đạt</button><button type="button" data-val="Không đạt">Không đạt</button></div>`);
    const restyle = (v: Verdict) => wrap.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
      b.classList.remove('sel-yes', 'sel-no');
      if (b.dataset.val === v) b.classList.add(v === 'Đạt' ? 'sel-yes' : 'sel-no');
    });
    wrap.querySelectorAll<HTMLButtonElement>('button').forEach(b =>
      b.addEventListener('click', () => { onChange(b.dataset.val as Verdict); restyle(b.dataset.val as Verdict); }));
    restyle(value);
    return wrap;
  }

  function refLine(item: AuditItem): string {
    const f = item.fields;
    const parts: string[] = [];
    if (f.location.expected) parts.push('Loc ' + f.location.expected);
    if (f.numCassettes.expected || f.colorCassettes.expected)
      parts.push('Cass ' + (f.numCassettes.expected || '?') + '/' + (f.colorCassettes.expected || '?'));
    if (f.numTec.expected || f.colorTec.expected)
      parts.push('Tec ' + (f.numTec.expected || '?') + '/' + (f.colorTec.expected || '?'));
    return parts.join(' · ') || '(trống)';
  }

  refreshCases();
  return { refreshCases };
}
