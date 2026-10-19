(() => {
  'use strict';

  /* ============================================================
     UTILITÁRIOS
     ============================================================ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const TIPO_LABEL = {
    IN: 'Incidente (IN)',
    TR: 'Rollout (TR)',
    REQ: 'Requisição (REQ)'
  };

  const MOV_LABEL = {
    DEVOLUCAO: 'Devolução / recolhimento',
    MANUTENCAO: 'Manutenção no local',
    EMPRESTIMO: 'Empréstimo',
    REMANEJAMENTO: 'Remanejamento',
    INSTALACAO: 'Instalação'
  };

  const STORAGE_KEY = 'wyntech.campo.v1';

  // Web App oficial (Apps Script): consulta o SIAD e gera o PDF do Laudo.
  // A URL não fica versionada; configure localStorage["wyntech.officialLaudoUrl"].
  const OFFICIAL_LAUDO_URL = (() => {
    try {
      return localStorage.getItem('wyntech.officialLaudoUrl') || '';
    } catch {
      return '';
    }
  })();

  function fmtLongDate(ddmmyyyy) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(ddmmyyyy || ''))) return ddmmyyyy || '—';
    const [d, m, y] = ddmmyyyy.split('/').map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${days[dt.getDay()]}, ${d} de ${months[m - 1]} de ${y}`;
  }

  let toastTimer = null;
  function showToast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
  }

  async function copyText(text) {
    if (!text) {
      showToast('Nada para copiar.');
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      showToast('Copiado para a área de transferência.');
    } catch {
      showToast('Não foi possível copiar automaticamente.');
    }
  }

  function shareWhatsApp(text) {
    if (!text) {
      showToast('Nada para compartilhar.');
      return;
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  /* ============================================================
     DADOS DE DEMONSTRAÇÃO
     ============================================================ */
  const DEFAULT_CALL = {
    os: 'TR1185398',
    ch: 'CH3817588',
    tipo: 'TR',
    comarca: 'Pará de Minas',
    setor: 'Vara Cível — Gabinete',
    contato: 'Dr. Roberto Álvares',
    telefone: '(37) 99864-5905',
    usuario: 'Dr. Roberto Álvares',
    matriculaUser: 'TJ-88412',
    tecnico: 'Renan Almeida',
    matriculaTec: 'WYN-1044',
    data: '14/10/2026',
    hora: '10:45',
    patrS: '100309615',
    patrI: '100412587',
    serialS: 'PF39X109',
    serialI: 'PF4A2C71',
    fabricanteRetirado: 'DATEN',
    modeloRetirado: 'Notebook DCM4A-4',
    fabricanteInstalado: 'LENOVO',
    modeloInstalado: 'ThinkPad L14 Gen 3',
    movimentacao: 'DEVOLUCAO',
    localVerif: 'Edifício Goiás',
    localRetirada: 'Fórum de Pará de Minas',
    localEntrega: 'Sala Polo Divinópolis',
    poloDestino: 'Sala Polo Divinópolis (1035145 COATEC - POLO DVL - RECOLHIMENTO)',
    transporte: 'Volante Wyntech',
    defeito: 'Substituição de notebook por término de contrato e rollout institucional do magistrado.',
    obs: 'Equipamento funcional, limpo e em bom estado de conservação.',
    acessorios: ['Cabo de energia', 'Fonte / carregador', 'Mouse', 'Teclado'],
    outros: 'Pasta de transporte executiva',
    avaria: false,
    avariaDesc: '',
    codFechamento: 'IN0028',
    peca: 'Notebook Lenovo ThinkPad L14',
    parecer: 'Atendimento concluído. Equipamento substituído, testado e configurado na rede corporativa. Usuário orientado e RAT assinado no local.',
    acoesTec: ['Diagnóstico', 'Substituição', 'Configuração', 'Teste de rede']
  };

  const DEFAULT_GRADES = { 1: 'B', 2: 'B', 3: 'B', 4: 'B', 5: 'B', 6: 'B' };
  const DEFAULT_ROLLOUT = { guia: true, rat: true, foto: true, laudo: true, termo: false, romaneio: false };

  const HISTORY = [
    {
      os: 'TR1185398', tipo: 'TR', comarca: 'Pará de Minas', setor: 'Vara Cível — Gabinete',
      user: 'Dr. Roberto Álvares', date: '14/10/2026', time: '10:45',
      s: '100309615', i: '100412587', status: 'Pendente', tone: 'amber', route: 'rollout',
      note: 'Romaneio ainda não anexado'
    },
    {
      os: 'IN2376285', tipo: 'IN', comarca: 'Pará de Minas', setor: 'Administração do Fórum',
      user: 'Adm. Fórum', date: '14/10/2026', time: '09:15',
      s: '100492266', i: '', status: 'Resolvido', tone: 'green', route: 'fechamento',
      note: 'Troca de IC concluída'
    },
    {
      os: 'TR1185220', tipo: 'TR', comarca: 'Itaúna', setor: 'Cartório Distribuidor',
      user: 'Marina Torres', date: '14/10/2026', time: '08:40',
      s: '100298412', i: '100492110', status: 'Concluído', tone: 'green', route: 'documentos',
      note: 'Sala Polo entregue'
    },
    {
      os: 'TR1184910', tipo: 'TR', comarca: 'Itaúna', setor: 'Secretaria Criminal',
      user: 'Paulo Mendes', date: '10/10/2026', time: '15:20',
      s: '100355890', i: '100412200', status: 'Concluído', tone: 'green', route: 'documentos',
      note: 'Laudo e romaneio assinados'
    },
    {
      os: 'IN2376011', tipo: 'IN', comarca: 'Divinópolis', setor: 'Secretaria Criminal',
      user: 'Paula Andrade', date: '09/10/2026', time: '11:05',
      s: '100355891', i: '', status: 'Aguardando peça', tone: 'amber', route: 'fechamento',
      note: 'Fonte em falta no estoque'
    }
  ];

  /* ============================================================
     ESTADO
     ============================================================ */
  const state = {
    call: { ...DEFAULT_CALL, acessorios: [...DEFAULT_CALL.acessorios], acoesTec: [...DEFAULT_CALL.acoesTec] },
    grades: { ...DEFAULT_GRADES },
    rollout: { ...DEFAULT_ROLLOUT },
    photos: [],
    pop: {},
    doc: { type: 'laudo-normal', blank: false },
    historyFilter: 'all',
    historySearch: ''
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.call) {
        state.call = { ...state.call, ...saved.call };
        state.call.acessorios = Array.isArray(saved.call.acessorios) ? saved.call.acessorios : state.call.acessorios;
        state.call.acoesTec = Array.isArray(saved.call.acoesTec) ? saved.call.acoesTec : state.call.acoesTec;
      }
      if (saved && saved.grades) state.grades = { ...state.grades, ...saved.grades };
      if (saved && saved.rollout) state.rollout = { ...state.rollout, ...saved.rollout };
    }
  } catch {
    /* localStorage indisponível: o protótipo continua em memória */
  }

  let saveTimer = null;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          call: state.call,
          grades: state.grades,
          rollout: state.rollout
        }));
      } catch {
        /* silencioso */
      }
    }, 180);
  }

  /* ============================================================
     ROTEAMENTO
     ============================================================ */
  const ROUTE_LABELS = {
    workspace: 'Painel',
    chamado: 'Novo chamado',
    equipamento: 'Equipamento',
    fechamento: 'Fechamento IN',
    rollout: 'Rollout TR',
    pop030: 'POP030',
    documentos: 'Documentos',
    historico: 'Histórico'
  };
  const ROUTES = Object.keys(ROUTE_LABELS);

  function routeFromHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.includes(raw) ? raw : 'workspace';
  }

  function renderRoute() {
    const route = routeFromHash();
    $$('.screen').forEach((screen) => screen.classList.toggle('is-active', screen.dataset.screen === route));
    $$('[data-nav]').forEach((link) => link.classList.toggle('is-active', link.dataset.nav === route));
    const context = $('#topbar-context');
    if (context) context.textContent = ROUTE_LABELS[route];
    document.title = `${ROUTE_LABELS[route]} · Wyntech Campo`;
    window.scrollTo(0, 0);
    if (route === 'documentos') syncDocsSummary();
    if (route === 'historico') renderHistory();
    if (route === 'pop030') renderPopContext();
  }

  /* ============================================================
     RENDERIZAÇÃO — PAINEL
     ============================================================ */
  function recordHtml(item) {
    const suffix = item.i ? ` / I ${esc(item.i)}` : '';
    return `
      <a class="record" href="#/${item.route}">
        <div class="record-os">${esc(item.os)} <span class="badge badge-${item.tone}">${esc(item.tipo)}</span></div>
        <div class="record-main">
          <div class="record-title">${esc(item.comarca)} · ${esc(item.setor)}</div>
          <div class="record-sub">${esc(item.user)} · S ${esc(item.s)}${suffix}</div>
        </div>
        <div class="record-meta">
          <span>${esc(item.date)}${item.time ? ` · ${esc(item.time)}` : ''}</span>
          <span class="badge badge-${item.tone}">${esc(item.status)}</span>
        </div>
      </a>`;
  }

  function renderRecent() {
    const target = $('#recent-list');
    if (!target) return;
    target.innerHTML = HISTORY.slice(0, 3).map(recordHtml).join('');
  }

  function renderKpis() {
    const today = '14/10/2026';
    const todays = HISTORY.filter((item) => item.date === today);
    const rollouts = todays.filter((item) => item.tipo === 'TR').length;
    const incidents = todays.filter((item) => item.tipo === 'IN').length;
    const pending = HISTORY.filter((item) => item.tone === 'amber').length;
    const done = HISTORY.filter((item) => item.tone === 'green').length;

    $('#kpi-hoje').textContent = String(todays.length);
    $('#kpi-hoje-foot').textContent = `${rollouts} rollout · ${incidents} incidente${incidents === 1 ? '' : 's'}`;
    $('#kpi-pendentes').textContent = String(pending);
    $('#kpi-pendentes-foot').textContent = 'romaneio e peça em aberto';
    $('#kpi-concluidos').textContent = String(done);
    $('#kpi-concluidos-foot').textContent = '100% com laudo';
  }

  /* ============================================================
     RENDERIZAÇÃO — CHAMADO / RESUMO
     ============================================================ */
  function syncSummary() {
    const c = state.call;
    const ready = Boolean(String(c.os || '').trim() && String(c.comarca || '').trim() && String(c.setor || '').trim());
    const text = (sel, value) => {
      const el = $(sel);
      if (el) el.textContent = value;
    };

    text('#sum-os', c.os || '—');
    text('#sum-tipo', TIPO_LABEL[c.tipo] || c.tipo || '—');
    text('#sum-comarca', c.comarca || '—');
    text('#sum-setor', c.setor || '—');
    text('#equip-tipo-label', TIPO_LABEL[c.tipo] || c.tipo || '—');
    text('#equip-patr-badge', c.patrS || '—');
    text('#in-os-badge', c.os || '—');

    const status = $('#sum-status');
    if (status) {
      status.textContent = ready ? 'Pronto para seguir' : 'Rascunho';
      status.className = `badge ${ready ? 'badge-green' : 'badge-mono'}`;
    }
    syncDocsSummary();
  }

  function syncDocsSummary() {
    const c = state.call;
    const set = (sel, value) => {
      const el = $(sel);
      if (el) el.textContent = value;
    };
    set('#doc-sum-os', c.os || '—');
    set('#doc-sum-local', `${c.comarca || '—'} / ${c.setor || '—'}`);
    set('#doc-sum-patr', `${c.patrS || '—'} / ${c.patrI || '—'}`);
    set('#doc-sum-data', c.data || '—');
  }

  function syncTypeButtons() {
    $$('[data-tipo]').forEach((button) => {
      const active = button.dataset.tipo === state.call.tipo;
      button.classList.toggle('is-on', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function syncAvaria() {
    $$('[data-avaria]').forEach((button) => {
      const active = (button.dataset.avaria === '1') === Boolean(state.call.avaria);
      button.classList.toggle('is-on', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const wrap = $('#avaria-wrap');
    if (wrap) wrap.hidden = !state.call.avaria;
  }

  function syncAccChips() {
    const selected = new Set(state.call.acessorios || []);
    $$('[data-acc]').forEach((chip) => chip.classList.toggle('is-on', selected.has(chip.dataset.acc)));
  }

  function syncTechChips() {
    const selected = new Set(state.call.acoesTec || []);
    $$('[data-tech]').forEach((chip) => chip.classList.toggle('is-on', selected.has(chip.dataset.tech)));
  }

  function syncGrades() {
    $$('[data-grade]').forEach((button) => {
      const item = button.dataset.grade;
      const value = button.dataset.value;
      const active = state.grades[item] === value;
      button.classList.toggle('is-on', active);
      button.classList.toggle('is-b', active && value === 'B');
      button.classList.toggle('is-r', active && value === 'R');
      button.classList.toggle('is-x', active && value === 'X');
      button.setAttribute('aria-pressed', String(active));
    });
    renderInCheck();
  }

  function syncRolloutChecklist() {
    const tasks = $$('[data-task]');
    tasks.forEach((task) => {
      const done = Boolean(state.rollout[task.dataset.task]);
      task.classList.toggle('is-done', done);
      task.setAttribute('aria-checked', String(done));
    });
    const total = Object.keys(state.rollout).length;
    const done = Object.values(state.rollout).filter(Boolean).length;
    const label = $('#rollout-progress-label');
    const bar = $('#rollout-progress');
    if (label) label.textContent = `${done} de ${total} concluídos`;
    if (bar) bar.style.width = `${Math.round((done / total) * 100)}%`;
    renderInCheck();
  }

  function hydrateInputs() {
    $$('[data-bind]').forEach((el) => {
      const value = state.call[el.dataset.bind];
      if (value !== undefined && value !== null) el.value = value;
    });
    syncTypeButtons();
    syncAvaria();
    syncAccChips();
    syncTechChips();
    syncGrades();
    syncRolloutChecklist();
    syncSummary();
  }

  function syncDerived() {
    syncSummary();
    syncAvaria();
    renderHpSolution();
    renderTransferText();
    renderCasoFortuito();
    renderPurchase();
    renderRollout();
    renderPopContext();
  }

  function validateCall() {
    const required = ['os', 'comarca', 'setor'];
    let firstInvalid = null;

    required.forEach((key) => {
      const el = $(`[data-bind="${key}"]`);
      if (!el) return;
      const bad = !String(el.value || '').trim();
      const field = el.closest('.field');
      el.classList.toggle('input-error', bad);
      if (field) field.classList.toggle('has-error', bad);
      if (bad && !firstInvalid) firstInvalid = el;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      showToast('Preencha OS, comarca e setor para continuar.');
      return false;
    }
    return true;
  }

  /* ============================================================
     POP030 — BASE DE CONHECIMENTO (v3.5 — FEV/2025)
     ============================================================ */
  const POP = [
    {
      id: '1', label: '1. Acréscimo',
      subs: [
        {
          id: 'comp', label: 'Computadores',
          fields: [
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' },
            { key: 'patrMon', label: 'Patrimônio do monitor', mono: true, value: '100492110' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizado o acréscimo dos computadores listados abaixo:\n(${v.patrComp} – ${v.patrMon} – ${v.user} – ${v.setor})`
        },
        {
          id: 'note', label: 'Notebooks',
          fields: [
            { key: 'patrNote', label: 'Patrimônio do notebook', mono: true, from: 'patrI' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizado o acréscimo dos notebooks listados abaixo:\n(${v.patrNote} – ${v.user} – ${v.setor})`
        },
        {
          id: 'mon', label: 'Monitores avulsos',
          fields: [
            { key: 'patrMon', label: 'Patrimônio do monitor', mono: true, value: '100492110' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' },
            { key: 'cabo', label: 'Tipo de cabo utilizado', value: 'HDMI para VGA' }
          ],
          script: (v) => `Foi realizado o acréscimo dos monitores listados abaixo:\n(${v.patrMon} – ${v.user} – ${v.setor} – ${v.patrComp} – ${v.cabo})`
        },
        {
          id: 'esc', label: 'Escâneres de mesa',
          fields: [
            { key: 'patrEquip', label: 'Patrimônio do escâner', mono: true, value: '100345678' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' }
          ],
          script: (v) => `Foi realizado o acréscimo dos escâneres listados abaixo:\n(${v.patrEquip} – ${v.user} – ${v.setor} – ${v.patrComp})`
        },
        {
          id: 'imp', label: 'Impressoras ou multifuncionais',
          fields: [
            { key: 'patrEquip', label: 'Patrimônio da impressora', mono: true, value: '100512340' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizado o acréscimo das impressoras listadas abaixo:\n(${v.patrEquip} – ${v.setor})`
        },
        {
          id: 'perif', label: 'Periféricos',
          fields: [
            { key: 'tipo', label: 'Tipo de periférico', value: 'Teclado e Mouse' },
            { key: 'patrEquip', label: 'Patrimônio do periférico', mono: true, value: 'S/N' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' }
          ],
          script: (v) => `Foi realizado o acréscimo dos periféricos listados abaixo:\n(${v.tipo} – ${v.patrEquip} – ${v.user} – ${v.setor} – ${v.patrComp})`
        },
        {
          id: 'switch', label: 'Switch',
          fields: [
            { key: 'patrEquip', label: 'Patrimônio do switch', mono: true, value: '100987654' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'andar', label: 'Andar', value: '2º Andar' }
          ],
          script: (v) => `Foi realizado o acréscimo dos switches listados abaixo:\n(${v.patrEquip} – ${v.setor} – ${v.andar})`
        },
        {
          id: 'ap', label: 'Access point',
          fields: [
            { key: 'patrEquip', label: 'Patrimônio do access point', mono: true, value: '100789012' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'andar', label: 'Andar', value: '2º Andar' }
          ],
          script: (v) => `Foi realizado o acréscimo dos access points listados abaixo:\n(${v.patrEquip} – ${v.setor} – ${v.andar})`
        },
        {
          id: 'serv', label: 'Servidor de rede',
          fields: [
            { key: 'patrEquip', label: 'Patrimônio do servidor', mono: true, value: '100123456' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'andar', label: 'Andar', value: '2º Andar' }
          ],
          script: (v) => `Foi realizado o acréscimo dos servidores de rede listados abaixo:\n(${v.patrEquip} – ${v.setor} – ${v.andar})`
        }
      ]
    },
    {
      id: '2', label: '2. Substituição (S: / I:)',
      subs: [
        {
          id: 'comp', label: 'Computadores (padrão S/I)',
          fields: [
            { key: 'patrCS', label: 'S: computador substituído', mono: true, from: 'patrS' },
            { key: 'patrMS', label: 'S: monitor substituído', mono: true, value: '100298412' },
            { key: 'patrCI', label: 'I: computador incluído', mono: true, from: 'patrI' },
            { key: 'patrMI', label: 'I: monitor incluído', mono: true, value: '100492110' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizado a substituição do computador:\n(S: ${v.patrCS} – S: ${v.patrMS} – I: ${v.patrCI} – I: ${v.patrMI} – ${v.user} – ${v.setor})`
        },
        {
          id: 'comp-irrep', label: 'Computadores (irreparabilidade)',
          fields: [
            { key: 'patrS', label: 'S: sobressalente Wyntech', mono: true, value: 'WYN-998811' },
            { key: 'patrI', label: 'I: computador incluído', mono: true, from: 'patrI' },
            { key: 'patrMon', label: 'I: monitor incluído', mono: true, value: '100492110' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizado a substituição do computador sobressalente:\n(S: ${v.patrS} – I: ${v.patrI} – I: ${v.patrMon} – ${v.user} – ${v.setor})`
        },
        {
          id: 'note', label: 'Notebooks (padrão S/I)',
          fields: [
            { key: 'patrS', label: 'S: notebook substituído', mono: true, from: 'patrS' },
            { key: 'patrI', label: 'I: notebook incluído', mono: true, from: 'patrI' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizado a substituição do computador:\n(S: ${v.patrS} – I: ${v.patrI} – ${v.user} – ${v.setor})`
        },
        {
          id: 'note-irrep', label: 'Notebooks (irreparabilidade)',
          fields: [
            { key: 'patrS', label: 'S: sobressalente Wyntech', mono: true, value: 'WYN-998811' },
            { key: 'patrI', label: 'I: notebook incluído', mono: true, from: 'patrI' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizado a substituição do notebook sobressalente:\n(S: ${v.patrS} – I: ${v.patrI} – ${v.user} – ${v.setor})`
        },
        {
          id: 'mon', label: 'Monitor avulso',
          fields: [
            { key: 'patrS', label: 'S: monitor substituído', mono: true, value: '100298412' },
            { key: 'patrI', label: 'I: monitor incluído', mono: true, value: '100492110' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' },
            { key: 'cabo', label: 'Tipo de cabo utilizado', value: 'HDMI para VGA' }
          ],
          script: (v) => `Foi realizada a substituição dos monitores listados abaixo:\n(S: ${v.patrS} – I: ${v.patrI} – ${v.user} – ${v.setor} – ${v.patrComp} – ${v.cabo})`
        },
        {
          id: 'mon-irrep', label: 'Monitor (irreparabilidade)',
          fields: [
            { key: 'patrS', label: 'S: sobressalente Wyntech', mono: true, value: 'WYN-998811' },
            { key: 'patrI', label: 'I: monitor incluído', mono: true, value: '100492110' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizado a substituição do monitor sobressalente:\n(S: ${v.patrS} – I: ${v.patrI} – ${v.user} – ${v.setor})`
        },
        {
          id: 'esc', label: 'Escâneres de mesa',
          fields: [
            { key: 'patrS', label: 'S: escâner substituído', mono: true, value: '100345678' },
            { key: 'patrI', label: 'I: escâner incluído', mono: true, value: '100456789' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizada a substituição dos escâneres listados abaixo:\n(S: ${v.patrS} – I: ${v.patrI} – ${v.user} – ${v.setor})`
        },
        {
          id: 'imp', label: 'Impressoras ou multifuncionais',
          fields: [
            { key: 'patrS', label: 'S: impressora substituída', mono: true, value: '100512340' },
            { key: 'patrI', label: 'I: impressora incluída', mono: true, value: '100512999' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizada a substituição das impressoras listadas abaixo:\n(S: ${v.patrS} – I: ${v.patrI} – ${v.setor})`
        },
        {
          id: 'perif', label: 'Periféricos',
          fields: [
            { key: 'tipo', label: 'Tipo do periférico', value: 'Teclado USB' },
            { key: 'patrS', label: 'S: periférico substituído', mono: true, value: '1009988' },
            { key: 'patrI', label: 'I: periférico incluído', mono: true, value: '1009999' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' }
          ],
          script: (v) => `Foi realizada a substituição dos periféricos listados abaixo:\n(${v.tipo} – S: ${v.patrS} – I: ${v.patrI} – ${v.user} – ${v.setor} – ${v.patrComp})`
        },
        {
          id: 'switch', label: 'Switch',
          fields: [
            { key: 'patrS', label: 'S: switch substituído', mono: true, value: '100987654' },
            { key: 'patrI', label: 'I: switch incluído', mono: true, value: '100987999' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'andar', label: 'Andar', value: '2º Andar' }
          ],
          script: (v) => `Foi realizada a substituição do switch listado abaixo:\n(S: ${v.patrS} – I: ${v.patrI} – ${v.setor} – ${v.andar})`
        },
        {
          id: 'ap', label: 'Access point',
          fields: [
            { key: 'patrS', label: 'S: access point substituído', mono: true, value: '100789012' },
            { key: 'patrI', label: 'I: access point incluído', mono: true, value: '100789999' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'andar', label: 'Andar', value: '2º Andar' }
          ],
          script: (v) => `Foi realizada a substituição dos access points listado abaixo:\n(S: ${v.patrS} – I: ${v.patrI} – ${v.setor} – ${v.andar})`
        },
        {
          id: 'serv', label: 'Servidor de rede',
          fields: [
            { key: 'patrS', label: 'S: servidor substituído', mono: true, value: '100123456' },
            { key: 'patrI', label: 'I: servidor incluído', mono: true, value: '100123999' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'andar', label: 'Andar', value: 'CPD' }
          ],
          script: (v) => `Foi realizada a substituição do servidor de rede listado abaixo:\n(S: ${v.patrS} – I: ${v.patrI} – ${v.setor} – ${v.andar})`
        }
      ]
    },
    {
      id: '3', label: '3. Instalação',
      subs: [
        {
          id: 'comp', label: 'Computadores',
          fields: [
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' },
            { key: 'patrMon', label: 'Patrimônio do monitor', mono: true, value: '100492110' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizada a instalação dos computadores listados abaixo:\n(${v.patrComp} – ${v.patrMon} – ${v.user} – ${v.setor})`
        },
        {
          id: 'note', label: 'Notebooks',
          fields: [
            { key: 'patrNote', label: 'Patrimônio do notebook', mono: true, from: 'patrI' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizada a instalação dos computadores listados abaixo:\n(${v.patrNote} – ${v.user} – ${v.setor})`
        },
        {
          id: 'mon', label: 'Monitores avulsos',
          fields: [
            { key: 'patrMon', label: 'Patrimônio do monitor', mono: true, value: '100492110' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' },
            { key: 'cabo', label: 'Tipo de cabo utilizado', value: 'HDMI para VGA' }
          ],
          script: (v) => `Foi realizada a instalação dos monitores listados abaixo:\n(${v.patrMon} – ${v.user} – ${v.setor} – ${v.patrComp} – ${v.cabo})`
        },
        {
          id: 'esc', label: 'Escâneres de mesa',
          fields: [
            { key: 'patrS', label: 'Patrimônio do escâner', mono: true, value: '100345678' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' }
          ],
          script: (v) => `Foi realizada a instalação dos escâneres listados abaixo:\n(${v.patrS} – ${v.user} – ${v.setor} – ${v.patrComp})`
        },
        {
          id: 'imp', label: 'Impressoras matriciais',
          fields: [
            { key: 'patrImp', label: 'Patrimônio da impressora', mono: true, value: '100512340' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' }
          ],
          script: (v) => `Foi realizada a instalação das impressoras listadas abaixo:\n(${v.patrImp} – ${v.setor})`
        },
        {
          id: 'perif', label: 'Periféricos',
          fields: [
            { key: 'tipo', label: 'Tipo de periférico', value: 'Teclado e Mouse' },
            { key: 'patr', label: 'Patrimônio do periférico', mono: true, value: 'S/N' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' }
          ],
          script: (v) => `Foi realizada a instalação dos periféricos listados abaixo:\n(${v.tipo} – ${v.patr} – ${v.user} – ${v.setor} – ${v.patrComp})`
        },
        {
          id: 'pecas', label: 'Instalação de peças',
          fields: [
            { key: 'tipoPeca', label: 'Tipo de peça', value: 'Memória RAM 16GB DDR4' },
            { key: 'patr', label: 'Patrimônio do equipamento', mono: true, from: 'patrI' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'edificacao', label: 'Edificação', value: 'Fórum da Comarca' }
          ],
          script: (v) => `Foi realizada a instalação das seguintes peças:\n(${v.tipoPeca} – ${v.patr} – ${v.user} – ${v.setor} – ${v.edificacao})`
        },
        {
          id: 'switch', label: 'Switch',
          fields: [
            { key: 'patr', label: 'Patrimônio do switch', mono: true, value: '100987654' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'andar', label: 'Andar', value: '2º Andar' }
          ],
          script: (v) => `Foi realizada a instalação dos switches listados abaixo:\n(${v.patr} – ${v.setor} – ${v.andar})`
        },
        {
          id: 'ap', label: 'Access point',
          fields: [
            { key: 'patr', label: 'Patrimônio do access point', mono: true, value: '100789012' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'andar', label: 'Andar', value: '2º Andar' }
          ],
          script: (v) => `Foi realizada a instalação dos access points listados abaixo:\n(${v.patr} – ${v.setor} – ${v.andar})`
        },
        {
          id: 'apps', label: 'Instalação / atualização / configuração de aplicativos',
          fields: [
            { key: 'app', label: 'Aplicativo e versão', value: 'PJe Office Pro v2.5' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'edificacao', label: 'Edificação', value: 'Fórum' }
          ],
          script: (v) => `Foi realizada a instalação/atualização/configuração dos aplicativos listados abaixo:\n(${v.app} – ${v.patrComp} – ${v.user} – ${v.setor} – ${v.edificacao})`
        },
        {
          id: 'desinst-apps', label: 'Desinstalação de aplicativos',
          fields: [
            { key: 'app', label: 'Aplicativo e versão', value: 'Versão legada Java 7' },
            { key: 'patrComp', label: 'Patrimônio do computador', mono: true, from: 'patrI' },
            { key: 'user', label: 'Nome do usuário', from: 'usuario' },
            { key: 'setor', label: 'Nome do setor', from: 'setor' },
            { key: 'edificacao', label: 'Edificação', value: 'Fórum' }
          ],
          script: (v) => `Foi realizada a desinstalação dos aplicativos listados abaixo:\n(${v.app} – ${v.patrComp} – ${v.user} – ${v.setor} – ${v.edificacao})`
        },
        {
          id: 'licencas', label: 'Remanejamento de licenças',
          fields: [
            { key: 'licenca', label: 'Licença e versão', value: 'Adobe Acrobat Pro v2024' },
            { key: 'patrOrig', label: 'Patrimônio de origem', mono: true, from: 'patrS' },
            { key: 'userOrig', label: 'Usuário de origem', from: 'usuario' },
            { key: 'setorOrig', label: 'Setor de origem', from: 'setor' },
            { key: 'patrDest', label: 'Patrimônio de destino', mono: true, from: 'patrI' },
            { key: 'userDest', label: 'Usuário de destino', from: 'usuario' },
            { key: 'setorDest', label: 'Setor de destino', from: 'setor' }
          ],
          script: (v) => `Foi realizado o remanejamento das licenças listadas abaixo:\n(${v.licenca} – ${v.patrOrig} – ${v.userOrig} – ${v.setorOrig} / ${v.patrDest} – ${v.userDest} – ${v.setorDest})`
        }
      ]
    },
    {
      id: '4', label: '4. Empréstimo',
      subs: [{
        id: 'emprestimo', label: 'Equipamentos emprestados',
        fields: [
          { key: 'tipo', label: 'Tipo de equipamento', value: 'Notebook Lenovo' },
          { key: 'qtd', label: 'Quantidade', value: '01' },
          { key: 'patrimonios', label: 'Patrimônios', mono: true, from: 'patrI' },
          { key: 'setor', label: 'Nome do setor', from: 'setor' },
          { key: 'user', label: 'Nome do usuário', from: 'usuario' }
        ],
        script: (v) => `Foi realizado o empréstimo dos equipamentos listados abaixo:\n(${v.tipo} – ${v.qtd} – ${v.patrimonios} – ${v.setor} – ${v.user})`
      }]
    },
    {
      id: '5', label: '5. Remanejamento',
      subs: [{
        id: 'remanejamento', label: 'Remanejamento de equipamento',
        fields: [
          { key: 'tipo', label: 'Tipo de equipamento', value: 'Notebook' },
          { key: 'patr', label: 'Patrimônio do equipamento', mono: true, from: 'patrI' },
          { key: 'userOrig', label: 'Usuário de origem', from: 'usuario' },
          { key: 'setorOrig', label: 'Setor de origem', from: 'setor' },
          { key: 'userDest', label: 'Usuário de destino', value: 'Dra. Cláudia' },
          { key: 'setorDest', label: 'Setor de destino', value: 'Gabinete Magistrado' }
        ],
        script: (v) => `Foi realizado o remanejamento dos equipamentos listados abaixo:\n(${v.tipo} – ${v.patr} – ${v.userOrig} / ${v.setorOrig} – ${v.userDest} / ${v.setorDest})`
      }]
    },
    {
      id: '6', label: '6. Mudança predial',
      subs: [{
        id: 'mudanca', label: 'Mudança predial geral',
        fields: [
          { key: 'comp', label: 'Computador (patr. – usuário – setor)', valueFn: (c) => `${c.patrI} – ${c.usuario} – ${c.setor}` },
          { key: 'mon', label: 'Monitor (patr. – usuário – setor)', valueFn: (c) => `100492110 – ${c.usuario} – ${c.setor}` },
          { key: 'note', label: 'Notebook (patr. – usuário – setor)', valueFn: (c) => `${c.patrS} – ${c.usuario} – ${c.setor}` },
          { key: 'esc', label: 'Escâner (patr. – setor)', valueFn: (c) => `100345678 – ${c.setor}` },
          { key: 'impMatricial', label: 'Impressora matricial (patr. – setor)', valueFn: (c) => `100512340 – ${c.setor}` },
          { key: 'serv', label: 'Servidor de rede (patr. – setor)', value: '100123456 – CPD 2º Andar' },
          { key: 'switch', label: 'Switch (patr. – setor)', value: '100987654 – CPD 2º Andar' },
          { key: 'ap', label: 'Access point (patr. – setor)', value: '100789012 – Corredor 2º Andar' },
          { key: 'webcam', label: 'Webcam (patr. – usuário – setor)', valueFn: (c) => `S/N – ${c.usuario} – ${c.setor}` },
          { key: 'mic', label: 'Microfone (patr. – setor)', value: 'S/N – Sala de Audiências' },
          { key: 'obs', label: 'Observações de avarias / estado geral', type: 'textarea', wide: true, value: 'Nenhuma avaria constatada durante o transporte predial.' }
        ],
        script: (v) => `Foi realizada a mudança predial de todos os equipamentos listados abaixo: (relacionar TODOS os equipamentos envolvidos na Mudança Predial). Em caso de avarias ou qualquer outra situação que fuja da normalidade de uma Mudança Predial, relacionar aqui nesse espaço em um campo de OBSERVAÇÕES.

COMPUTADOR:
(${v.comp})

MONITOR:
(${v.mon})

NOTEBOOK:
(${v.note})

ESCÂNER:
(${v.esc})

IMPRESSORA MATRICIAL:
(${v.impMatricial})

SERVIDOR DE REDE:
(${v.serv})

SWITCH:
(${v.switch})

ACCESS POINT:
(${v.ap})

WEB CAM:
(${v.webcam})

MICROFONE:
(${v.mic})

OBSERVAÇÕES: ${v.obs}`
      }]
    },
    {
      id: '7', label: '7. Acompanhamento técnico para evento',
      subs: [{
        id: 'evento', label: 'Acompanhamento técnico para evento',
        fields: [
          { key: 'tecnicos', label: 'Técnicos que acompanharam', from: 'tecnico' },
          { key: 'datas', label: 'Datas do acompanhamento', valueFn: (c) => c.data }
        ],
        script: (v) => `Foi realizado o acompanhamento técnico no local do evento.\n(${v.tecnicos} – ${v.datas})`
      }]
    },
    {
      id: '8', label: '8. Transporte de equipamentos',
      subs: [{
        id: 'transporte', label: 'Transporte de equipamentos',
        fields: [
          { key: 'origem', label: 'Local de origem', valueFn: (c) => `Fórum de ${c.comarca} – ${c.setor}` },
          { key: 'destino', label: 'Local de destino', from: 'poloDestino' },
          { key: 'tipo', label: 'Tipo de equipamento', value: 'Notebook' },
          { key: 'patr', label: 'Patrimônio', mono: true, from: 'patrS' }
        ],
        script: (v) => `Foi realizado o transporte dos equipamentos listados abaixo:\n(Local de origem: ${v.origem})\n(Local de destino: ${v.destino})\n(${v.tipo} – ${v.patr})`
      }]
    },
    {
      id: '9', label: '9. Recolhimento de equipamentos',
      subs: [{
        id: 'recolhimento', label: 'Recolhimento de equipamentos',
        fields: [
          { key: 'tipo', label: 'Tipo de equipamento', value: 'Notebook Daten' },
          { key: 'patr', label: 'Patrimônio', mono: true, from: 'patrS' },
          { key: 'user', label: 'Nome do usuário', from: 'usuario' },
          { key: 'setor', label: 'Nome do setor', from: 'setor' }
        ],
        script: (v) => `Foi realizado o recolhimento dos equipamentos listados abaixo:\n(${v.tipo} – ${v.patr} – ${v.user} – ${v.setor})`
      }]
    },
    {
      id: '10', label: '10. Manutenção preventiva de escâner',
      subs: [{
        id: 'esc-prev', label: 'Manutenção preventiva de escâner',
        fields: [
          { key: 'patrimonios', label: 'Patrimônios (separados por vírgula)', mono: true, valueFn: (c) => `${c.patrS}, 100345678, 100345679` }
        ],
        script: (v) => `Foi realizada a manutenção preventiva do(s) Escâner(es) com o(s) patrimônio(s) relacionado(s) abaixo:\n(${v.patrimonios})`
      }]
    },
    {
      id: '11', label: '11. Intervenção no switch',
      subs: [{
        id: 'switch-interv', label: 'Intervenções no ativo de rede switch',
        fields: [
          { key: 'sol', label: 'Solução aplicada', value: 'Substituição de patch cord danificado' },
          { key: 'hw', label: 'Problema de hardware', value: 'cabo defeituoso' },
          { key: 'config', label: 'Problema de configuração', value: 'N/A' },
          { key: 'trafego', label: 'Problema de tráfego', value: 'N/A' },
          { key: 'porta', label: 'Nº da porta', mono: true, value: 'Porta 24' },
          { key: 'patr', label: 'Patrimônio do switch', mono: true, value: '100987654' },
          { key: 'diag', label: 'Diagnóstico do problema', value: 'Link oscilando devido a conector RJ45 quebrado', wide: true },
          {
            key: 'agente', label: 'Agente do diagnóstico', type: 'select',
            options: ['Técnicos rede Wyntech', 'Analistas rede Stefannini'],
            value: 'Técnicos rede Wyntech', wide: true
          }
        ],
        script: (v) => `Foi realizado a intervenção no switch conforme informações listados abaixo:\n(Solução: ${v.sol})\n(Problemas de hardware [ porta inoperante | cabo defeituoso | cabo não homologado | interruptor | ... ]: ${v.hw})\n(Problemas de configuração: ${v.config})\n(Problemas de tráfego: ${v.trafego})\n(Especificar nº Porta: ${v.porta})\n(Especificar Patrimonio: ${v.patr})\n(Diagnóstico do Problema: ${v.diag})\n(Agente do Diagnóstico [Técnicos rede Wyntech | Analistas rede Stefannini]: ${v.agente})`
      }]
    },
    {
      id: '12', label: '12. Remanejamento predial entre unidades',
      subs: [{
        id: 'remanej-predial', label: 'Remanejamento predial entre unidades',
        fields: [
          { key: 'tipo', label: 'Tipo de equipamento', value: 'Notebook' },
          { key: 'patr', label: 'Patrimônio do equipamento', mono: true, from: 'patrI' },
          { key: 'unidOrig', label: 'Unidade de origem', value: 'Edifício Sede' },
          { key: 'userOrig', label: 'Usuário de origem', from: 'usuario' },
          { key: 'setorOrig', label: 'Setor de origem', from: 'setor' },
          { key: 'unidDest', label: 'Unidade de destino', value: 'Anexo Administrativo' },
          { key: 'userDest', label: 'Usuário de destino', value: 'Dra. Cláudia' },
          { key: 'setorDest', label: 'Setor de destino', value: 'Juizado Especial' }
        ],
        script: (v) => `Foi realizado o remanejamento dos equipamentos listados abaixo entre as Unidades (Edificações):\n(${v.tipo} – ${v.patr} – ${v.unidOrig} / ${v.userOrig} / ${v.setorOrig} – ${v.unidDest} / ${v.userDest} / ${v.setorDest})`
      }]
    },
    {
      id: '13', label: '13. Ativação de ponto de rede',
      subs: [{
        id: 'ativ-ponto', label: 'Ativação de ponto de rede',
        fields: [
          {
            key: 'tipo', label: 'Tipo de periférico', type: 'select',
            options: ['Computador', 'Impressora', 'Access point', 'Outro'], value: 'Computador'
          },
          { key: 'patr', label: 'Patrimônio do periférico', mono: true, from: 'patrI' },
          { key: 'setor', label: 'Nome do setor', from: 'setor' },
          { key: 'patrSwitch', label: 'Patrimônio do switch', mono: true, value: '100987654' }
        ],
        script: (v) => `Foi realizado a ativação do ponto de rede com os seguintes informes abaixo:\n(${v.tipo} – ${v.patr} – ${v.setor} – ${v.patrSwitch})`
      }]
    },
    {
      id: '14', label: '14. Vistoria técnica / levantamento predial',
      subs: [{
        id: 'vistoria', label: 'Vistoria técnica / levantamento predial',
        fields: [
          { key: 'comp', label: 'Computador (patr. – usuário – setor – armário S/N)', valueFn: (c) => `${c.patrI} – ${c.usuario} – ${c.setor} – Guardado em armário (N)` },
          { key: 'mon', label: 'Monitor (patr. – usuário – setor – armário S/N)', valueFn: (c) => `100492110 – ${c.usuario} – ${c.setor} – Guardado em armário (N)` },
          { key: 'note', label: 'Notebook (patr. – usuário – setor – armário S/N)', valueFn: (c) => `${c.patrS} – ${c.usuario} – ${c.setor} – Guardado em armário (N)` },
          { key: 'esc', label: 'Escâner (patr. – setor – armário S/N)', valueFn: (c) => `100345678 – ${c.setor} – Guardado em armário (N)` },
          { key: 'impLaser', label: 'Impressora laser (patr. – setor – armário S/N)', valueFn: (c) => `100554433 – ${c.setor} – Guardado em armário (N)` },
          { key: 'impMulti', label: 'Impressora multifuncional (patr. – setor – armário S/N)', valueFn: (c) => `100554499 – ${c.setor} – Guardado em armário (N)` },
          { key: 'impMatricial', label: 'Impressora matricial (patr. – setor – armário S/N)', valueFn: (c) => `100554400 – ${c.setor} – Guardado em armário (N)` }
        ],
        script: (v) => `Foi realizado o levantamento de informações, conforme detalhamento abaixo e planilha anexada à tarefa de execução:

COMPUTADOR:
(${v.comp})

MONITOR:
(${v.mon})

NOTEBOOK:
(${v.note})

ESCÂNER:
(${v.esc})

IMPRESSORA LASER:
(${v.impLaser})

IMPRESSORA MULTIFUNCIONAL:
(${v.impMulti})

IMPRESSORA MATRICIAL:
(${v.impMatricial})`
      }]
    }
  ];

  /* ============================================================
     POP030 — RENDERIZAÇÃO
     ============================================================ */
  function currentPop() {
    const sitSelect = $('#pop-sit');
    const subSelect = $('#pop-sub');
    const sit = POP.find((item) => item.id === (sitSelect ? sitSelect.value : '1')) || POP[0];
    const sub = sit.subs.find((item) => item.id === (subSelect ? subSelect.value : '')) || sit.subs[0];
    return { sit, sub, key: `${sit.id}:${sub.id}` };
  }

  function getPopValues(sub, key) {
    const store = state.pop[key] || {};
    const values = {};
    sub.fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(store, field.key)) {
        values[field.key] = store[field.key];
      } else if (typeof field.valueFn === 'function') {
        values[field.key] = field.valueFn(state.call);
      } else if (field.from) {
        values[field.key] = state.call[field.from] ?? '';
      } else {
        values[field.key] = field.value ?? '';
      }
    });
    return values;
  }

  function renderPopFields() {
    const { sub, key } = currentPop();
    const target = $('#pop-fields');
    if (!target) return;
    const values = getPopValues(sub, key);

    target.innerHTML = sub.fields.map((field) => {
      const id = `pop-f-${field.key}`;
      const value = values[field.key] ?? '';
      let control = '';
      if (field.type === 'select') {
        const options = (field.options || []).map((option) => {
          const selected = String(option) === String(value) ? ' selected' : '';
          return `<option value="${esc(option)}"${selected}>${esc(option)}</option>`;
        }).join('');
        control = `<select class="select" id="${id}" data-pop-key="${field.key}">${options}</select>`;
      } else if (field.type === 'textarea') {
        control = `<textarea class="textarea" id="${id}" data-pop-key="${field.key}" style="min-height:76px">${esc(value)}</textarea>`;
      } else {
        control = `<input class="input ${field.mono ? 'mono-input' : ''}" id="${id}" data-pop-key="${field.key}" value="${esc(value)}" autocomplete="off">`;
      }
      return `<div class="field${field.wide ? ' field-wide' : ''}"><label class="label" for="${id}">${esc(field.label)}</label>${control}</div>`;
    }).join('');
  }

  function renderPopScript() {
    const { sub, key } = currentPop();
    const values = getPopValues(sub, key);
    const target = $('#pop-script');
    if (target) target.textContent = sub.script ? sub.script(values, state.call) : '';
  }

  function renderPopContext() {
    const c = state.call;
    const set = (sel, value) => {
      const el = $(sel);
      if (el) el.textContent = value;
    };
    set('#pop-context-os', c.os || '—');
    set('#pop-context-comarca', c.comarca || '—');
    set('#pop-context-patr', `${c.patrS || '—'} / ${c.patrI || '—'}`);
    set('#pop-context-user', `${c.usuario || '—'} · ${c.setor || '—'}`);
  }

  function populatePopSubtypes(preferred) {
    const sitSelect = $('#pop-sit');
    const subSelect = $('#pop-sub');
    if (!sitSelect || !subSelect) return;
    const sit = POP.find((item) => item.id === sitSelect.value) || POP[0];
    subSelect.innerHTML = sit.subs.map((sub) => `<option value="${sub.id}">${esc(sub.label)}</option>`).join('');
    if (preferred && sit.subs.some((sub) => sub.id === preferred)) subSelect.value = preferred;
    renderPopFields();
    renderPopScript();
  }

  function syncPop() {
    const { sub, key } = currentPop();
    if (!state.pop[key]) state.pop[key] = {};
    sub.fields.forEach((field) => {
      if (field.from) state.pop[key][field.key] = state.call[field.from] ?? '';
    });
    renderPopFields();
    renderPopScript();
    renderPopContext();
    showToast('Campos sincronizados com o chamado.');
  }

  function sharePop() {
    const script = ($('#pop-script')?.textContent || '').trim();
    shareWhatsApp(`*WYNTECH · POP030 — FECHAMENTO HP*\n*Chamado:* ${state.call.os} (${state.call.comarca})\n\n${script}`);
  }

  function initPop030() {
    const sitSelect = $('#pop-sit');
    if (!sitSelect) return;
    sitSelect.innerHTML = POP.map((sit) => `<option value="${sit.id}">${esc(sit.label)}</option>`).join('');
    sitSelect.value = '2';
    populatePopSubtypes('note');
    sitSelect.addEventListener('change', () => populatePopSubtypes());
    $('#pop-sub')?.addEventListener('change', () => {
      renderPopFields();
      renderPopScript();
    });
  }

  /* ============================================================
     TEXTOS OPERACIONAIS
     ============================================================ */
  function selectedOptionText(select) {
    if (!select || select.selectedIndex < 0) return '';
    return select.options[select.selectedIndex].textContent.trim();
  }

  function renderHpSolution() {
    const c = state.call;
    const target = $('#hp-in-text');
    if (!target) return;
    const cod = selectedOptionText($('#f-cod')) || c.codFechamento;
    const acoes = (c.acoesTec || []).join(' · ') || '—';
    const text = [
      `Atendimento presencial realizado na Comarca de ${c.comarca} — ${c.setor}.`,
      `Pessoa de contato: ${c.contato} | Telefone: ${c.telefone}`,
      '',
      `Patrimônio: ${c.patrS} | Modelo: ${c.modeloRetirado}`,
      `Código de fechamento HP: ${cod}`,
      `Peça / equipamento aplicado: ${c.peca}`,
      '',
      'Parecer técnico:',
      c.parecer,
      '',
      `Ações realizadas: ${acoes}`,
      '[X] Equipamento operacional e testado',
      '[X] Conectividade de rede corporativa validada',
      '[X] RAT do HP impresso, conferido e assinado pelo usuário',
      '',
      `Técnico volante: ${c.tecnico} — ${c.matriculaTec}`
    ].join('\n');
    target.textContent = text;
  }

  function renderTransferText() {
    const c = state.call;
    const target = $('#transf-patri-text');
    if (!target) return;
    target.textContent = [
      'Título da tarefa:',
      'Transferência Patrimonial — Polo Divinópolis',
      '',
      'Descrição:',
      `Devido à substituição dos equipamentos relacionados ao atendimento ${c.os}, solicito a transferência dos seguintes patrimônios:`,
      '',
      `${c.patrS} — ${c.modeloRetirado} — para ${c.poloDestino}`,
      `${c.patrI} — ${c.modeloInstalado} — para ${c.comarca} / ${c.setor}`,
      '',
      'Observação: anexar somente o Romaneio na tarefa de transferência.',
      '',
      `Técnico responsável: ${c.tecnico} — ${c.matriculaTec}`
    ].join('\n');
  }

  function renderCasoFortuito() {
    const c = state.call;
    const target = $('#caso-fortuito-text');
    if (!target) return;
    target.textContent = [
      `Registro de caso fortuito — ${c.os}`,
      '',
      `Equipamento: ${c.patrS} — ${c.modeloRetirado}`,
      `Comarca: ${c.comarca} / ${c.setor}`,
      '',
      'Descrição do dano:',
      c.avariaDesc || '[descrever o dano, a causa provável e as evidências]',
      '',
      'Nexo com o uso normal: não identificado.',
      '',
      `Técnico: ${c.tecnico} — ${c.matriculaTec}`
    ].join('\n');
  }

  function renderPurchase() {
    const c = state.call;
    const target = $('#pedido-compra-text');
    if (!target) return;
    target.textContent = [
      `Assunto: Solicitação de compra emergencial — ${c.os}`,
      '',
      'Prezado gestor,',
      '',
      `Solicito autorização para compra emergencial da peça/equipamento abaixo, necessária para a conclusão do atendimento ${c.os} na comarca de ${c.comarca}.`,
      '',
      `Peça: ${c.peca}`,
      'Quantidade: 1',
      `Justificativa: ${c.parecer}`,
      '',
      `Atenciosamente,`,
      `${c.tecnico}`,
      `${c.matriculaTec} — Wyntech / Suporte TJMG`
    ].join('\n');
  }

  function renderRollout() {
    const c = state.call;
    const set = (sel, value) => {
      const el = $(sel);
      if (el) el.textContent = value;
    };
    set('#rollout-patr-s', c.patrS || '—');
    set('#rollout-model-s', c.modeloRetirado || '—');
    set('#rollout-serial-s', c.serialS || '—');
    set('#rollout-patr-i', c.patrI || '—');
    set('#rollout-model-i', c.modeloInstalado || '—');
    set('#rollout-serial-i', c.serialI || '—');
    set('#rollout-user', c.usuario || '—');
    set('#rollout-setor', c.setor || '—');
    set('#rollout-comarca', c.comarca || '—');

    const msg = $('#rollout-msg-text');
    if (msg) {
      msg.textContent = `Foi realizado a substituição do computador:\n(S: ${c.patrS} - I: ${c.patrI} - ${c.usuario} - ${c.setor})`;
    }
    syncRolloutChecklist();
  }

  /* ============================================================
     FOTOS
     ============================================================ */
  function renderPhotos() {
    const target = $('#photo-grid');
    if (!target) return;
    if (!state.photos.length) {
      target.innerHTML = '<span class="hint-text">Nenhuma foto adicionada.</span>';
      renderInCheck();
      return;
    }
    target.innerHTML = state.photos.map((src, index) => `
      <div class="photo-item">
        <img src="${src}" alt="Foto ${index + 1} do equipamento">
        <button class="photo-remove" type="button" data-remove-photo="${index}" aria-label="Remover foto ${index + 1}">
          <svg class="icon"><use href="#i-x"/></svg>
        </button>
      </div>`).join('');
    renderInCheck();
  }

  function setQuickCallout(id, ok, text) {
    const box = document.getElementById(id);
    if (!box) return;
    box.classList.toggle('callout-success', ok);
    box.classList.toggle('callout-warn', !ok);
    const use = box.querySelector('use');
    if (use) use.setAttribute('href', ok ? '#i-check' : '#i-alert');
    const label = box.querySelector('div');
    if (label) label.textContent = text;
  }

  function renderInCheck() {
    if (!document.getElementById('check-checklist')) return;
    const grades = Object.values(state.grades);
    const graded = grades.length > 0 && grades.every(Boolean);
    setQuickCallout('check-checklist', graded, graded ? 'Checklist técnico preenchido' : 'Checklist técnico incompleto');
    const photos = state.photos.length;
    setQuickCallout('check-photos', photos > 0, photos > 0 ? `Fotos registradas (${photos})` : 'Nenhuma foto registrada');
    const romaneio = Boolean(state.rollout.romaneio);
    setQuickCallout('check-romaneio', romaneio, romaneio ? 'Romaneio conferido' : 'Romaneio pendente de anexo no HP');
  }

  /* ============================================================
     DOCUMENTOS — LAUDO TÉCNICO / ROLLOUT (PRINT 02)
     ============================================================ */
  const DOC_META = {
    'laudo-normal': {
      title: 'Laudo Técnico Unificado v5.0',
      sub: 'Movimentação e verificação de equipamento'
    },
    'laudo-rollout': {
      title: 'Laudo de Rollout',
      sub: 'Notebook substituído · Sala Polo Divinópolis'
    },
    romaneio: {
      title: 'Romaneio de Substituição',
      sub: 'Anexar ao incidente TJMG GEOPE/COATE'
    }
  };

  function docChk(label, checked) {
    return `<span class="doc-chk"><span class="doc-chk-box${checked ? ' is-on' : ''}" aria-hidden="true"></span>${label}</span>`;
  }

  function gradeLine(grade, blank) {
    const labels = ['Bom', 'Regular', 'Ruim'];
    const map = { B: 'Bom', R: 'Regular', X: 'Ruim' };
    const active = blank ? '' : (map[grade] || 'Bom');
    return labels.map((label) => docChk(label, active === label)).join(' &nbsp; ');
  }

  function renderLaudoSheet(blank, isRollout) {
    const c = state.call;
    const value = (val, fallback = '________________') => blank ? fallback : esc(val || fallback);
    const osVal = value(c.os);
    const dataVal = blank ? '___/___/______' : esc(c.data || '___/___/______');
    const manutChecked = !blank && !isRollout && c.movimentacao === 'MANUTENCAO';
    const devolChecked = !blank && (isRollout || c.movimentacao !== 'MANUTENCAO');
    const localVerif = value(c.localVerif);
    const localRet = value(`${c.localRetirada} / ${c.setor}`);
    const localEnt = value(isRollout ? 'Sala Polo Divinópolis' : c.localEntrega);
    const patrVal = value(c.patrS);
    const serialVal = value(c.serialS);
    const tipoModelo = value(c.modeloRetirado);
    const fabricante = value(c.fabricanteRetirado);
    const tjmgLine = `${docChk('Bom', false)} &nbsp; ${docChk('Regular', false)} &nbsp; ${docChk('Ruim', false)}`;

    const accs = ['Cabo de Energia', 'Fonte / Carregador', 'Mouse', 'Teclado', 'Cabo de Dados / USB', 'Outros'];
    const accLine = accs.map((name) => {
      const isOther = name === 'Outros';
      const has = (c.acessorios || []).some((item) => item.toLowerCase() === name.toLowerCase());
      const checked = !blank && (isOther ? Boolean((c.outros || '').trim()) : has);
      const extra = isOther ? `: ${blank ? '________________________' : esc(c.outros || '—')}` : '';
      return `<span class="doc-chk-item">${docChk(name, checked)}${extra}</span>`;
    }).join('');

    const justificativa = blank
      ? ''
      : (isRollout
        ? 'Substituição por Rollout de notebook institucional TJMG. Equipamento antigo recolhido para envio à Sala Polo Divinópolis.'
        : (c.defeito || 'Equipamento recolhido para reparo e verificação técnica especializada.'));

    const avariaChecked = !blank && Boolean(c.avaria);
    const semAvariaChecked = !blank && !c.avaria;
    const avariaTexto = blank ? '' : (c.avaria ? (c.avariaDesc || 'Avaria constatada na conferência.') : 'Sem avarias físicas constatadas no ato da conferência.');

    const obs = blank
      ? ''
      : (isRollout
        ? 'Equipamento antigo conferido e embalado com seus respectivos cabos. Pronto para transferência patrimonial e remessa para a Sala Polo TJMG Divinópolis.'
        : (c.obs || 'Equipamento conferido no local.'));

    const declaracao = blank
      ? `${docChk('Manutenção', false)} &nbsp; ${docChk('Estoque para a Sala Polo da comarca de', false)} ___________________________________`
      : (isRollout
        ? `${docChk('Manutenção', false)} &nbsp; ${docChk('Estoque para a Sala Polo da comarca de', true)} <span style="font-weight:bold; border-bottom:1px solid #000; padding:0 8px;">Divinópolis</span>`
        : (c.movimentacao === 'MANUTENCAO'
          ? `${docChk('Manutenção', true)} &nbsp; ${docChk('Estoque para a Sala Polo da comarca de', false)} ___________________________________`
          : `${docChk('Manutenção', false)} &nbsp; ${docChk('Estoque para a Sala Polo da comarca de', true)} <span style="font-weight:bold; border-bottom:1px solid #000; padding:0 8px;">${esc(c.comarca)}</span>`));

    return `
      <div class="laudo-doc-sheet">
        <div class="laudo-header-row">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
              <svg width="30" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6L8 18L12 9L16 18L21 6" stroke="#c22227" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <div style="font-family:Arial, Helvetica, sans-serif; font-weight:900; font-size:18px; color:#111; letter-spacing:-0.5px; line-height:1;">wyntech</div>
              <div style="font-family:Arial, Helvetica, sans-serif; font-size:7.5px; font-weight:bold; color:#a82020; letter-spacing:0.8px; margin-top:2px;">SERVIÇOS EM INFORMÁTICA</div>
            </div>
          </div>
          <div class="laudo-header-title">
            <h1>LAUDO TÉCNICO</h1>
            <p>Movimentação e Verificação de Equipamento de Informática</p>
          </div>
          <div aria-hidden="true"></div>
        </div>

        <div class="laudo-sec-title">I. Identificação e Movimentação</div>
        <table class="laudo-tbl">
          <tr>
            <td style="width:25%;"><span class="laudo-field-lbl">Nº OS / Tarefa / Incidente:</span><span>${osVal}</span></td>
            <td style="width:25%;"><span class="laudo-field-lbl">Data de Atendimento:</span><span>${dataVal}</span></td>
            <td style="width:25%;"><span class="laudo-field-lbl">Tipo de Movimentação:</span><span>${docChk('Manutenção', manutChecked)} &nbsp; ${docChk('Devolução', devolChecked)}</span></td>
            <td style="width:25%;"><span class="laudo-field-lbl">Local de Verificação:</span><span>${localVerif}</span></td>
          </tr>
          <tr>
            <td><span class="laudo-field-lbl">Local de Retirada:</span><span>${localRet}</span></td>
            <td><span class="laudo-field-lbl">Local de Entrega:</span><span>${localEnt}</span></td>
            <td><span class="laudo-field-lbl">Patrimônio:</span><span style="font-weight:${blank ? 'normal' : 'bold'};">${patrVal}</span></td>
            <td><span class="laudo-field-lbl">Nº de Série:</span><span>${serialVal}</span></td>
          </tr>
          <tr>
            <td colspan="2"><span class="laudo-field-lbl">Tipo de Equipamento / Modelo:</span><span>${tipoModelo}</span></td>
            <td colspan="2"><span class="laudo-field-lbl">Fabricante:</span><span>${fabricante}</span></td>
          </tr>
        </table>

        <div class="laudo-sec-title">II. Entrega com</div>
        <div class="laudo-box">
          <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:6px;">${accLine}</div>
          <div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:4px;">
            <span class="laudo-field-lbl is-block">Informações adicionais / Justificativa da movimentação:</span>
            <div style="font-size:9.5px; color:#222; min-height:16px;">${blank ? '<div style="height:14px;"></div>' : esc(justificativa)}</div>
          </div>
        </div>

        <div class="laudo-sec-title">III. Checklist Técnico de Verificação</div>
        <table class="laudo-chk-tbl">
          <thead>
            <tr>
              <th style="text-align:left; width:46%;">Item de Verificação</th>
              <th style="width:27%;">WYNTECH (Bom/Regular/Ruim)</th>
              <th style="width:27%;">TJMG (OK/NOK)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1. Funcionamento geral do equipamento</td><td style="text-align:center;">${gradeLine(state.grades[1], blank)}</td><td style="text-align:center;">${tjmgLine}</td></tr>
            <tr><td>2. Cabos, conexões e acessórios íntegros e funcionais</td><td style="text-align:center;">${gradeLine(state.grades[4], blank)}</td><td style="text-align:center;">${tjmgLine}</td></tr>
            <tr><td>3. Estado de limpeza e conservação externa</td><td style="text-align:center;">${gradeLine(state.grades[5], blank)}</td><td style="text-align:center;">${tjmgLine}</td></tr>
            <tr><td>4. Placa de patrimônio/etiqueta de nº de série legíveis</td><td style="text-align:center;">${gradeLine(state.grades[5], blank)}</td><td style="text-align:center;">${tjmgLine}</td></tr>
            <tr><td>5. Ausência de avarias (amassados, quebrados, arranhões)</td><td style="text-align:center;">${gradeLine(c.avaria ? 'X' : state.grades[5], blank)}</td><td style="text-align:center;">${tjmgLine}</td></tr>
            <tr><td>6. Outro item relevante ao equipamento:<div style="border-bottom:1px solid #666; margin-top:2px; min-height:11px;">${blank ? '' : esc(c.outros || 'Bolsa, Suporte')}</div></td><td style="text-align:center;">${gradeLine(state.grades[6], blank)}</td><td style="text-align:center;">${tjmgLine}</td></tr>
          </tbody>
        </table>

        <div class="laudo-sec-title">IV. Avarias</div>
        <div class="laudo-box">
          <div>Encontrada(s) avaria(s) (amassados, quebrados, etc.)? &nbsp;&nbsp; ${docChk('Não', semAvariaChecked)} &nbsp; ${docChk('Sim. Quais?', avariaChecked)}</div>
          <div style="min-height:16px; margin-top:2px; font-size:9.5px; color:#444;">${blank ? '' : esc(avariaTexto)}</div>
        </div>

        <div class="laudo-sec-title">V. Observações Gerais</div>
        <div class="laudo-box" style="min-height:44px;">${blank ? '&nbsp;' : esc(obs)}</div>

        <div class="laudo-sec-title">VI. Declaração</div>
        <div style="font-size:9.5px; line-height:1.4; margin-bottom:8px;">
          Atesto que o referido equipamento de informática foi recolhido para: &nbsp; ${declaracao}, encontrando-se em conformidade com as condições descritas neste laudo.
        </div>

        <div class="laudo-signatures-block">
          <div class="laudo-sec-title">VII. Assinaturas</div>
          <div class="laudo-signatures">
            <div><div class="laudo-sig-line">Responsável Técnico Wyntech</div><div style="font-size:8.5px; color:#444; margin-top:2px;">${blank ? '&nbsp;' : esc(c.tecnico)}</div></div>
            <div><div class="laudo-sig-line">Responsável TJMG</div><div style="font-size:8.5px; color:#444; margin-top:2px;">${blank ? '&nbsp;' : esc(c.usuario)}</div></div>
            <div><div class="laudo-sig-line">Entregue para / Recebido por</div><div style="font-size:8.5px; color:#444; margin-top:2px;">${blank ? '&nbsp;' : 'Sala Polo Divinópolis'}</div></div>
          </div>

          <div class="laudo-footer-note">Laudo Técnico WYNTECH — Modelo oficial de uso interno</div>
        </div>
      </div>`;
  }

  /* ============================================================
     DOCUMENTOS — ROMANEIO (PRINT 03)
     ============================================================ */
  function renderRomaneioSheet(blank) {
    const c = state.call;
    const obs = blank
      ? '&nbsp;'
      : esc(`Substituição realizada conforme solicitação ${c.os}. Equipamento retirado destinado à ${c.poloDestino}. Equipamento instalado entregue pronto para uso no setor ${c.setor}, devidamente testado.`);
    const footerDate = blank
      ? '____ de ________________ de ______'
      : esc(fmtLongDate(c.data));

    return `
      <div class="romaneio-doc-sheet">
        <table class="romaneio-header-box">
          <tr>
            <td style="width:20%; text-align:center; vertical-align:middle; border-right:1.5px solid #000;">
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
                <svg width="46" height="38" viewBox="0 0 100 85" fill="none">
                  <path d="M50 4 L94 78 L6 78 Z" fill="#b91c1c" stroke="#991b1b" stroke-width="2"/>
                  <path d="M50 20 L78 68 L22 68 Z" fill="#ffffff"/>
                  <path d="M50 32 L66 62 L34 62 Z" fill="#b91c1c"/>
                </svg>
                <div style="font-family:Arial, sans-serif; font-weight:900; font-size:10px; color:#000; letter-spacing:0.5px; margin-top:2px;">TJMG</div>
                <div style="font-family:Arial, sans-serif; font-size:6px; color:#222; line-height:1.1; text-align:center;">Tribunal de Justiça do<br>Estado de Minas Gerais</div>
              </div>
            </td>
            <td style="width:80%; text-align:center; vertical-align:middle;">
              <div style="font-size:13.5px; font-weight:bold; letter-spacing:0.3px; color:#000;">TRIBUNAL DE JUSTIÇA DO ESTADO DE MINAS GERAIS</div>
              <div style="font-size:11px; font-weight:bold; margin-top:4px; color:#000;">Diretoria Executiva de Tecnologia da Informação e<br>Comunicação – GEOPE/COATE</div>
            </td>
          </tr>
        </table>

        <div class="romaneio-main-title">
          <h1>SUBSTITUIÇÃO DE EQUIPAMENTO</h1>
          <p>Anexar ao Incidente</p>
        </div>

        <div class="romaneio-fill-line">
          <strong>DATA DE RETIRADA:</strong>
          <span class="romaneio-fill" style="width:46%;">${blank ? '&nbsp;' : esc(c.data)}</span>
        </div>
        <div class="romaneio-fill-line">
          <strong>Horário:</strong>
          <span class="romaneio-fill" style="width:20%;">${blank ? '&nbsp;' : esc(c.hora)}</span>
        </div>
        <div class="romaneio-fill-line" style="margin-top:6px;">
          <strong>COMARCA/UNIDADE:</strong>
          <span class="romaneio-fill" style="flex:1;">${blank ? '&nbsp;' : `${esc(c.comarca)} / ${esc(c.setor)}`}</span>
        </div>
        <div class="romaneio-fill-line">
          <strong>INCIDENTE:</strong>
          <span class="romaneio-fill" style="flex:1;">${blank ? '&nbsp;' : esc(c.os)}</span>
        </div>

        <div class="romaneio-section-bar">RETIRADA EQUIPAMENTO - COMARCA/SETOR ➔ SALA POLO</div>
        <table class="romaneio-tbl">
          <thead>
            <tr><th style="width:33%;">Equipamento</th><th style="width:33%;">Patrimônio</th><th style="width:34%;">Número de Série</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>${blank ? '&nbsp;' : esc(c.modeloRetirado)}</td>
              <td style="font-weight:${blank ? 'normal' : 'bold'};">${blank ? '&nbsp;' : esc(c.patrS)}</td>
              <td>${blank ? '&nbsp;' : esc(c.serialS)}</td>
            </tr>
          </tbody>
        </table>

        <div class="romaneio-section-bar">SUBSTITUIÇÃO EQUIPAMENTO - SALA POLO ➔ COMARCA/SETOR</div>
        <table class="romaneio-tbl">
          <thead>
            <tr><th style="width:33%;">Equipamento</th><th style="width:33%;">Patrimônio</th><th style="width:34%;">Número de Série</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>${blank ? '&nbsp;' : esc(c.modeloInstalado)}</td>
              <td style="font-weight:${blank ? 'normal' : 'bold'};">${blank ? '&nbsp;' : esc(c.patrI)}</td>
              <td>${blank ? '&nbsp;' : esc(c.serialI)}</td>
            </tr>
          </tbody>
        </table>

        <div class="romaneio-obs-box">
          <div class="romaneio-obs-header">OBSERVAÇÕES:</div>
          <div class="romaneio-obs-content">${obs}</div>
        </div>

        <table class="romaneio-sig-tbl">
          <tr>
            <td style="width:50%;"><strong>USUÁRIO:</strong> ${blank ? '' : esc(c.usuario)}</td>
            <td style="width:25%;"><strong>MATRÍCULA:</strong> ${blank ? '' : esc(c.matriculaUser)}</td>
            <td style="width:25%;"><strong>Ass.:</strong></td>
          </tr>
          <tr>
            <td><strong>TÉCNICO:</strong> ${blank ? '' : esc(c.tecnico)}</td>
            <td><strong>MATRÍCULA:</strong> ${blank ? '' : esc(c.matriculaTec)}</td>
            <td><strong>Ass.:</strong></td>
          </tr>
          <tr>
            <td colspan="2"><strong>RESPONSÁVEL TRANSPORTE:</strong> ${blank ? '' : esc(c.transporte)}</td>
            <td><strong>Ass.:</strong></td>
          </tr>
        </table>

        <div class="romaneio-footer-date">${footerDate}</div>
      </div>`;
  }

  /* ============================================================
     MODAL DE DOCUMENTOS
     ============================================================ */
  let lastFocused = null;

  function renderDocSheet() {
    const target = $('#doc-sheet');
    if (!target) return;
    target.innerHTML = state.doc.type === 'romaneio'
      ? renderRomaneioSheet(state.doc.blank)
      : renderLaudoSheet(state.doc.blank, state.doc.type === 'laudo-rollout');
  }

  function setDocMode(blank) {
    state.doc.blank = Boolean(blank);
    const filled = $('#mode-filled');
    const empty = $('#mode-blank');
    if (filled) {
      filled.classList.toggle('is-on', !blank);
      filled.setAttribute('aria-pressed', String(!blank));
    }
    if (empty) {
      empty.classList.toggle('is-on', Boolean(blank));
      empty.setAttribute('aria-pressed', String(Boolean(blank)));
    }
    const meta = DOC_META[state.doc.type] || DOC_META['laudo-normal'];
    const sub = $('#doc-modal-sub');
    if (sub) sub.textContent = `${meta.sub} · ${blank ? 'folha em branco' : 'dados do atendimento'}`;
    renderDocSheet();
  }

  function openDoc(type, blank) {
    if (!DOC_META[type]) type = 'laudo-normal';
    state.doc.type = type;
    state.doc.blank = Boolean(blank);
    const meta = DOC_META[type];
    const title = $('#doc-modal-title');
    if (title) title.textContent = meta.title;
    const hint = $('#doc-foot-hint');
    if (hint) hint.textContent = 'Use “Salvar como PDF” na janela de impressão.';
    lastFocused = document.activeElement;
    setDocMode(Boolean(blank));
    const modal = $('#doc-modal');
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => $('#doc-modal [data-action="close-doc"]')?.focus(), 40);
    }
  }

  function closeDoc() {
    const modal = $('#doc-modal');
    if (modal) modal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function shareDoc(type, blank) {
    const c = state.call;
    const meta = DOC_META[type] || DOC_META['laudo-normal'];
    const mode = blank ? '(FOLHA EM BRANCO)' : '(PREENCHIDO)';
    const text = [
      `*${meta.title.toUpperCase()} ${mode}*`,
      `*OS:* ${c.os} | *CH:* ${c.ch}`,
      `*Comarca / setor:* ${c.comarca} — ${c.setor}`,
      `*Usuário:* ${c.usuario} (${c.matriculaUser})`,
      `*Retirado (S):* ${c.patrS} — ${c.modeloRetirado}`,
      `*Instalado (I):* ${c.patrI} — ${c.modeloInstalado}`,
      `*Destino:* ${c.poloDestino}`,
      `*Técnico:* ${c.tecnico} (${c.matriculaTec})`
    ].join('\n');
    shareWhatsApp(text);
  }

  /* ============================================================
     GERADOR OFICIAL (APPS SCRIPT)
     ============================================================ */
  const OFFICIAL_ACCESSORIES = ['Cabo de Energia', 'Fonte / Carregador', 'Mouse', 'Teclado', 'Cabo de Dados / USB'];

  function normOfficialText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function officialDraft(type) {
    const c = state.call;
    const isRollout = type === 'laudo-rollout';
    const accSet = new Set((c.acessorios || []).map(normOfficialText));
    const dateMatch = String(c.data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const isoDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : '';
    const estoque = isRollout || c.movimentacao !== 'MANUTENCAO';
    const gradeMap = { B: 'Bom', R: 'Regular', X: 'Ruim' };
    const dados = {
      comarcaAtendimento: c.comarca || '',
      patrimonio: c.patrS || '',
      tarefa: c.os || '',
      data: isoDate,
      movimento: estoque ? 'Devolução' : 'Manutenção',
      verificacao: c.localVerif || '',
      retirada: [c.localRetirada, c.setor].filter(Boolean).join(' / '),
      entrega: isRollout ? 'Sala Polo Divinópolis' : (c.localEntrega || ''),
      serie: c.serialS || '',
      modelo: c.modeloRetirado || '',
      fabricante: c.fabricanteRetirado || '',
      outros: c.outros || '',
      justificativa: isRollout
        ? 'Substituição por Rollout de notebook institucional TJMG. Equipamento antigo recolhido para envio à Sala Polo Divinópolis.'
        : (c.defeito || ''),
      outroItem: c.outros || '',
      avarias: c.avaria ? 'Sim' : 'Não',
      quais: c.avaria ? (c.avariaDesc || '') : '',
      observacoes: isRollout
        ? 'Equipamento antigo conferido e embalado com seus respectivos cabos. Pronto para transferência patrimonial e remessa para a Sala Polo TJMG Divinópolis.'
        : (c.obs || ''),
      destino: estoque ? 'Estoque' : 'Manutenção',
      comarca: estoque ? (isRollout ? 'Divinópolis' : (c.comarca || '')) : ''
    };

    OFFICIAL_ACCESSORIES.forEach((name, index) => {
      dados[`a${index}`] = accSet.has(normOfficialText(name));
    });
    dados.a5 = Boolean(String(c.outros || '').trim());

    for (let index = 0; index < 6; index += 1) {
      dados[`c${index}`] = gradeMap[state.grades[index + 1]] || 'Bom';
    }

    return { versao: 1, dados };
  }

  function downloadOfficialDraft(type) {
    const label = type === 'laudo-rollout' ? 'Rollout' : 'Laudo';
    const payload = officialDraft(type);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rascunho_${label}_${state.call.patrS || 'atendimento'}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast(`Rascunho do ${label.toLowerCase()} baixado. No gerador, use "Abrir rascunho".`);
  }

  /* ============================================================
     HISTÓRICO
     ============================================================ */
  function renderHistory() {
    const list = $('#history-list');
    if (!list) return;
    const filter = state.historyFilter;
    const query = state.historySearch.trim().toLowerCase();
    const filtered = HISTORY.filter((item) => {
      const matchesFilter = filter === 'all' || item.tipo === filter || item.comarca === filter;
      const haystack = `${item.os} ${item.comarca} ${item.setor} ${item.user} ${item.s} ${item.i} ${item.status} ${item.note}`.toLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    });

    list.innerHTML = filtered.map(recordHtml).join('');
    const empty = $('#history-empty');
    if (empty) empty.hidden = filtered.length > 0;
    $$('[data-filter]').forEach((chip) => chip.classList.toggle('is-on', chip.dataset.filter === state.historyFilter));
  }

  /* ============================================================
     AÇÕES
     ============================================================ */
  function toggleAccessory(name) {
    const set = new Set(state.call.acessorios || []);
    if (set.has(name)) set.delete(name); else set.add(name);
    state.call.acessorios = Array.from(set);
    saveSoon();
    syncAccChips();
  }

  function toggleTech(name) {
    const set = new Set(state.call.acoesTec || []);
    if (set.has(name)) set.delete(name); else set.add(name);
    state.call.acoesTec = Array.from(set);
    saveSoon();
    syncTechChips();
    renderHpSolution();
  }

  function toggleTask(key) {
    if (!(key in state.rollout)) return;
    state.rollout[key] = !state.rollout[key];
    saveSoon();
    syncRolloutChecklist();
  }

  function handleAction(action, element, event) {
    event.preventDefault();
    switch (action) {
      case 'doc': {
        const type = element.dataset.doc;
        const blank = element.dataset.mode === 'blank';
        const view = element.dataset.view || 'view';
        if (view === 'whatsapp') {
          shareDoc(type, blank);
          return;
        }
        openDoc(type, blank);
        if (view === 'print') setTimeout(() => window.print(), 350);
        return;
      }
      case 'official-draft':
        downloadOfficialDraft(element.dataset.docType);
        return;
      case 'copy': {
        const selector = element.dataset.copy;
        const text = selector ? ($(selector)?.textContent || '') : '';
        copyText(text.trim());
        return;
      }
      case 'close-doc':
        closeDoc();
        return;
      case 'add-photo':
        $('#photo-input')?.click();
        return;
      case 'consultar-siad':
        showToast('Consulta ao SIAD disponível na versão integrada. Preencha o patrimônio manualmente neste protótipo.');
        return;
      case 'sync-pop':
        syncPop();
        return;
      case 'share-pop':
        sharePop();
        return;
      case 'go-equipamento':
        if (validateCall()) location.hash = '#/equipamento';
        return;
      case 'go-rollout':
        if (validateCall()) location.hash = '#/rollout';
        return;
      case 'go-fechamento':
        if (validateCall()) location.hash = '#/fechamento';
        return;
      default:
        return;
    }
  }

  function onBoundChange(event) {
    const el = event.target.closest('[data-bind]');
    if (el) {
      state.call[el.dataset.bind] = el.value;
      if (['os', 'comarca', 'setor'].includes(el.dataset.bind)) {
        el.classList.remove('input-error');
        el.closest('.field')?.classList.remove('has-error');
      }
      saveSoon();
      syncDerived();
      return;
    }

    const popEl = event.target.closest('[data-pop-key]');
    if (popEl) {
      const { key } = currentPop();
      if (!state.pop[key]) state.pop[key] = {};
      state.pop[key][popEl.dataset.popKey] = popEl.value;
      renderPopScript();
    }
  }

  /* ============================================================
     EVENTOS
     ============================================================ */
  document.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
      handleAction(actionEl.dataset.action, actionEl, event);
      return;
    }

    const tipo = event.target.closest('[data-tipo]');
    if (tipo) {
      state.call.tipo = tipo.dataset.tipo;
      saveSoon();
      syncTypeButtons();
      syncDerived();
      return;
    }

    const acc = event.target.closest('[data-acc]');
    if (acc) { toggleAccessory(acc.dataset.acc); return; }

    const avaria = event.target.closest('[data-avaria]');
    if (avaria) {
      state.call.avaria = avaria.dataset.avaria === '1';
      saveSoon();
      syncAvaria();
      syncDerived();
      return;
    }

    const grade = event.target.closest('[data-grade]');
    if (grade) {
      state.grades[grade.dataset.grade] = grade.dataset.value;
      saveSoon();
      syncGrades();
      return;
    }

    const tech = event.target.closest('[data-tech]');
    if (tech) { toggleTech(tech.dataset.tech); return; }

    const task = event.target.closest('[data-task]');
    if (task) { toggleTask(task.dataset.task); return; }

    const removePhoto = event.target.closest('[data-remove-photo]');
    if (removePhoto) {
      state.photos.splice(Number(removePhoto.dataset.removePhoto), 1);
      renderPhotos();
      return;
    }

    const filter = event.target.closest('[data-filter]');
    if (filter) {
      state.historyFilter = filter.dataset.filter;
      renderHistory();
      return;
    }

    if (event.target.closest('#mode-filled')) { setDocMode(false); return; }
    if (event.target.closest('#mode-blank')) { setDocMode(true); return; }
    if (event.target === $('#doc-modal')) { closeDoc(); }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('#doc-modal')?.classList.contains('is-open')) {
      closeDoc();
      return;
    }
    const task = event.target.closest('[data-task]');
    if (task && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      toggleTask(task.dataset.task);
    }
  });

  ['input', 'change'].forEach((type) => document.addEventListener(type, onBoundChange));

  $('#history-search')?.addEventListener('input', (event) => {
    state.historySearch = event.target.value;
    renderHistory();
  });

  $('#photo-input')?.addEventListener('change', (event) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    const room = 6 - state.photos.length;
    if (!room) {
      showToast('Limite de 6 fotos por atendimento.');
      event.target.value = '';
      return;
    }
    files.slice(0, room).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        state.photos.push(String(reader.result));
        renderPhotos();
      };
      reader.readAsDataURL(file);
    });
    if (files.length > room) showToast('Foram adicionadas apenas as primeiras fotos dentro do limite de 6.');
    event.target.value = '';
  });

  $('#doc-print')?.addEventListener('click', () => window.print());
  $('#doc-share')?.addEventListener('click', () => shareDoc(state.doc.type, state.doc.blank));

  $('.skip-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    const main = $('#main');
    if (!main) return;
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    main.focus({ preventScroll: true });
    main.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('hashchange', renderRoute);

  /* ============================================================
     INICIALIZAÇÃO
     ============================================================ */
  function init() {
    hydrateInputs();
    const officialLink = $('#official-open');
    if (officialLink) {
      if (OFFICIAL_LAUDO_URL) {
        officialLink.href = OFFICIAL_LAUDO_URL;
      } else {
        officialLink.removeAttribute('href');
        officialLink.setAttribute('aria-disabled', 'true');
        officialLink.title = 'Configure localStorage.wyntech.officialLaudoUrl para habilitar.';
      }
    }
    renderRecent();
    renderKpis();
    renderRoute();
    renderPhotos();
    renderHistory();
    syncDerived();
    initPop030();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
