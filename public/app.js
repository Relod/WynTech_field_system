'use strict';

/* Wyntech Campo TJMG — cliente do MVP real.
   Sem framework: roteamento por hash, fetch com cookie HttpOnly e renderização
   de telas em HTML escapado. */

const state = {
  user: null,
  config: {
    officialLaudoUrl: '',
    version: '',
  },
  renderToken: 0,
  chamadoAtual: null,
};

const els = {
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  loginSubmit: document.getElementById('login-submit'),
  appLoading: document.getElementById('app-loading'),
  app: document.getElementById('app'),
  view: document.getElementById('view'),
  toast: document.getElementById('toast'),
  sidebarAvatar: document.getElementById('sidebar-avatar'),
  sidebarName: document.getElementById('sidebar-name'),
  sidebarRole: document.getElementById('sidebar-role'),
  topbarAvatar: document.getElementById('topbar-avatar'),
  topbarContext: document.getElementById('topbar-context'),
};

class ApiError extends Error {
  constructor(message, status = 0, code = 'ERROR', details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/* ---------- Utilidades ---------- */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return character;
    }
  });
}

function icon(name, className = 'icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'técnico';
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function todayLocal() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const [year, month, day] = raw.split('-');
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status) {
  return {
    ABERTO: 'Aberto',
    EM_ANDAMENTO: 'Em andamento',
    FINALIZADO: 'Finalizado',
  }[status] || status;
}

function statusBadge(status) {
  const style = {
    ABERTO: 'badge-amber',
    EM_ANDAMENTO: 'badge-blue',
    FINALIZADO: 'badge-green',
  }[status] || '';
  return `<span class="badge ${style}">${escapeHtml(statusLabel(status))}</span>`;
}

function tipoLabel(tipo) {
  return { IN: 'Instalação', TR: 'Troca', REQ: 'Requisição' }[tipo] || tipo || '—';
}

function acaoLabel(acao) {
  return {
    VERIFICACAO: 'Verificação',
    RETIRADA: 'Retirada',
    INSTALACAO: 'Instalação',
    TROCA: 'Troca',
  }[acao] || acao || '—';
}

function movimentacaoLabel(tipo) {
  return {
    MANUTENCAO: 'Manutenção',
    DEVOLUCAO: 'Devolução',
  }[tipo] || tipo || '—';
}

function documentoLabel(tipo) {
  return {
    LAUDO: 'Laudo técnico',
    LAUDO_ROLLOUT: 'Laudo de rollout',
    ROMANEIO: 'Romaneio',
  }[tipo] || tipo || 'Documento';
}

function roleLabel(user) {
  if (!user) return '—';
  return user.papel === 'ADMIN' ? 'Administrador' : user.cargo || 'Técnico';
}

function paperLabel(user) {
  if (!user) return '—';
  return user.papel === 'ADMIN' ? 'Administrador' : 'Técnico';
}

function optionList(items, selected = '') {
  return items
    .map(([value, label]) => {
      const isSelected = String(value) === String(selected);
      return `<option value="${escapeHtml(value)}"${isSelected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function emptyState(title, text, action = '') {
  return `
    <div class="empty">
      ${icon('clipboard', 'icon icon-lg')}
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
      ${action ? `<div class="mt-12">${action}</div>` : ''}
    </div>
  `;
}

function errorPanel(message, retry = false) {
  return `
    <div class="error-panel" role="alert">
      <strong>Não foi possível concluir.</strong>
      <span>${escapeHtml(message || 'Tente novamente em instantes.')}</span>
      ${retry ? `<div class="mt-12"><button class="btn btn-secondary btn-sm" type="button" data-action="recarregar">${icon('refresh')} Tentar novamente</button></div>` : ''}
    </div>
  `;
}

function showToast(message, type = '') {
  els.toast.textContent = message;
  els.toast.className = `toast is-on${type === 'error' ? ' is-error' : ''}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.className = 'toast';
  }, 3600);
}

function setLoginError(message = '') {
  els.loginError.textContent = message;
  els.loginError.classList.toggle('is-on', Boolean(message));
}

function setBusy(button, busy, label = 'Salvando…') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${escapeHtml(label)}`;
    button.disabled = true;
  } else {
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    button.disabled = false;
  }
}

function setView(html, token) {
  if (token !== state.renderToken) return;
  els.view.innerHTML = html;
}

function setLoading(token) {
  if (token !== state.renderToken) return;
  els.view.innerHTML = '<div class="loading-panel"><span class="spinner" aria-hidden="true"></span> Carregando…</div>';
}

function setChrome(section, title, context) {
  document.querySelectorAll('[data-nav]').forEach((element) => {
    element.classList.toggle('is-active', element.dataset.nav === section);
  });
  document.title = `${title} · Wyntech Campo TJMG`;
  if (els.topbarContext) els.topbarContext.textContent = context || title;
}

function updateUserInterface() {
  if (!state.user) return;
  const avatar = initials(state.user.nome);
  const role = roleLabel(state.user);
  els.sidebarAvatar.textContent = avatar;
  els.sidebarName.textContent = state.user.nome;
  els.sidebarRole.textContent = role;
  els.topbarAvatar.textContent = avatar;
}

function showLogin(message = '') {
  state.chamadoAtual = null;
  els.loginScreen.hidden = false;
  els.app.hidden = true;
  els.appLoading.hidden = true;
  setLoginError(message);
  window.setTimeout(() => {
    if (!els.loginScreen.hidden) els.loginEmail.focus();
  }, 40);
}

function showApp() {
  els.loginScreen.hidden = true;
  els.app.hidden = false;
  els.appLoading.hidden = true;
  setLoginError('');
  updateUserInterface();
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  const options = { method, credentials: 'same-origin', headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0, 'NETWORK_ERROR');
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    const sessionCodes = new Set(['UNAUTHENTICATED', 'INVALID_TOKEN', 'EXPIRED_TOKEN', 'INVALID_SESSION']);
    if (state.user && sessionCodes.has(payload?.code)) {
      state.user = null;
      state.config = { officialLaudoUrl: '', version: '' };
      showLogin('Sua sessão expirou. Entre novamente.');
    }
    throw new ApiError(payload?.error || 'Sessão expirada.', 401, payload?.code);
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.error || `Não foi possível concluir a operação (HTTP ${response.status}).`,
      response.status,
      payload?.code,
      payload?.details
    );
  }

  return payload;
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  return {
    parts: pathPart.split('/').filter(Boolean),
    query: new URLSearchParams(queryPart),
  };
}

function listHash(filtros, page = 1) {
  const params = new URLSearchParams();
  if (filtros.busca) params.set('busca', filtros.busca);
  if (filtros.status) params.set('status', filtros.status);
  if (filtros.tipo) params.set('tipo', filtros.tipo);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `#/chamados${query ? `?${query}` : ''}`;
}

function recordHtml(chamado) {
  return `
    <a class="record" href="#/chamados/${chamado.id}">
      <div class="record-os">
        <div class="record-os-line"><span class="mono">${escapeHtml(chamado.numero_os)}</span></div>
        <div class="record-sub">${escapeHtml(formatDate(chamado.data_atendimento))}</div>
      </div>
      <div class="record-main">
        <div class="record-title">${escapeHtml(chamado.setor || 'Setor não informado')}</div>
        <div class="record-sub">${escapeHtml(chamado.comarca_nome)} · ${escapeHtml(tipoLabel(chamado.tipo))}</div>
      </div>
      <div class="record-meta">
        ${statusBadge(chamado.status)}
        ${icon('chevron-right', 'icon icon-chevron')}
      </div>
    </a>
  `;
}

function dataItem(label, value, options = {}) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
  const classes = ['data-item'];
  if (options.wide) classes.push('wide');
  const valueClasses = ['data-value'];
  if (options.mono) valueClasses.push('mono');
  if (options.pre) valueClasses.push('pre-line');
  if (!hasValue) valueClasses.push('is-empty');
  return `
    <div class="${classes.join(' ')}">
      <div class="data-label">${escapeHtml(label)}</div>
      <div class="${valueClasses.join(' ')}">${hasValue ? escapeHtml(String(value)) : '—'}</div>
    </div>
  `;
}

/* ---------- Login / sessão ---------- */

function applySession(data) {
  state.user = data.usuario;
  state.config = {
    ...state.config,
    ...(data.config || {}),
  };
}

async function bootstrap() {
  els.appLoading.hidden = false;
  els.loginScreen.hidden = true;
  els.app.hidden = true;

  try {
    const result = await api('/api/auth/me');
    applySession(result.data);
    showApp();
    await renderRoute();
  } catch (error) {
    if (error.status === 401) {
      showLogin();
    } else {
      showLogin();
      setLoginError(error.message || 'Não foi possível conectar ao servidor.');
    }
  } finally {
    els.appLoading.hidden = true;
  }
}

async function doLogin(event) {
  event.preventDefault();
  setLoginError('');
  setBusy(els.loginSubmit, true, 'Entrando…');

  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: {
        email: els.loginEmail.value.trim(),
        senha: els.loginPassword.value,
      },
    });
    applySession(result.data);
    els.loginPassword.value = '';
    showApp();
    showToast(`Bem-vindo, ${firstName(state.user.nome)}.`);
    if (!window.location.hash || window.location.hash === '#/login') {
      window.location.hash = '#/';
    } else {
      await renderRoute();
    }
  } catch (error) {
    setLoginError(error.message || 'E-mail ou senha inválidos.');
  } finally {
    setBusy(els.loginSubmit, false);
  }
}

async function doLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // A sessão local deve ser encerrada mesmo se o servidor já a tiver expirado.
  }
  state.user = null;
  state.chamadoAtual = null;
  state.config = { officialLaudoUrl: '', version: '' };
  showLogin();
  window.location.hash = '';
}

/* ---------- Roteamento ---------- */

async function renderRoute() {
  if (!state.user) return;

  const token = ++state.renderToken;
  const route = parseHash();
  const first = route.parts[0] || '';

  let section = 'dashboard';
  let title = 'Painel';
  let context = 'Painel';

  if (first === 'chamados' && route.parts[1] === 'novo') {
    section = 'novo';
    title = 'Novo chamado';
    context = 'Novo chamado';
  } else if (first === 'chamados') {
    section = 'chamados';
    title = route.parts[1] ? 'Chamado' : 'Chamados';
    context = route.parts[1] ? 'Chamado' : 'Chamados';
  } else if (first === 'perfil') {
    section = 'perfil';
    title = 'Meu perfil';
    context = 'Meu perfil';
  }

  setChrome(section, title, context);
  setLoading(token);

  try {
    if (!route.parts.length) {
      await renderDashboard(token);
    } else if (first === 'chamados' && route.parts.length === 1) {
      await renderChamados(token, route.query);
    } else if (first === 'chamados' && route.parts[1] === 'novo') {
      await renderNovoChamado(token);
    } else if (first === 'chamados' && route.parts.length === 2) {
      await renderDetalheChamado(token, route.parts[1]);
    } else if (first === 'perfil') {
      await renderPerfil(token);
    } else {
      renderNotFound(token);
    }
  } catch (error) {
    if (token !== state.renderToken) return;
    if (error.status === 401) return;
    if (error.status === 404) {
      setView(
        `<div class="page-head"><div class="page-head-main"><div class="eyebrow">Chamados</div><h1>Não encontrado</h1><p class="lede">${escapeHtml(error.message)}</p></div></div>${emptyState('Chamado não encontrado', 'Ele pode ter sido excluído ou pertence a outro usuário.', '<a class="btn btn-secondary btn-sm" href="#/chamados">Voltar para chamados</a>')}`,
        token
      );
      return;
    }
    setView(
      `<div class="page-head"><div class="page-head-main"><div class="eyebrow">Wyntech Campo</div><h1>Algo saiu do previsto</h1></div></div>${errorPanel(error.message, true)}`,
      token
    );
  }
}

function renderNotFound(token) {
  setView(
    `<div class="page-head"><div class="page-head-main"><div class="eyebrow">Wyntech Campo</div><h1>Página não encontrada</h1><p class="lede">O endereço acessado não existe neste console.</p></div></div>${emptyState('Nada por aqui', 'Volte ao painel para continuar o atendimento.', '<a class="btn btn-primary btn-sm" href="#/">Ir para o painel</a>')}`,
    token
  );
}

/* ---------- Painel ---------- */

async function renderDashboard(token) {
  const result = await api('/api/dashboard');
  if (token !== state.renderToken) return;

  const { resumo, recentes } = result.data;
  const recentesHtml = recentes.length
    ? `<div class="record-list">${recentes.map(recordHtml).join('')}</div>`
    : emptyState(
        'Nenhum chamado ainda',
        'Abra o primeiro chamado para começar a registrar o atendimento.',
        '<a class="btn btn-primary btn-sm" href="#/chamados/novo">Abrir chamado</a>'
      );

  const html = `
    <div class="page-head">
      <div class="page-head-main">
        <div class="eyebrow">Painel operacional</div>
        <h1>${greeting()}, ${escapeHtml(firstName(state.user.nome))}.</h1>
        <p class="lede">
          ${resumo.hoje > 0
            ? `${resumo.hoje} atendimento${resumo.hoje === 1 ? '' : 's'} registrado${resumo.hoje === 1 ? '' : 's'} hoje.`
            : 'Nenhum atendimento registrado hoje até agora.'}
          Você tem ${resumo.em_andamento} chamado${resumo.em_andamento === 1 ? '' : 's'} em andamento.
        </p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-secondary" type="button" data-action="atualizar-painel">${icon('refresh')} Atualizar</button>
        <a class="btn btn-primary" href="#/chamados/novo">${icon('plus')} Novo chamado</a>
      </div>
    </div>

    <div class="kpi-strip kpi-4">
      <div class="kpi">
        <div class="kpi-label">${icon('clipboard')} Total</div>
        <div class="kpi-value">${resumo.total}</div>
        <div class="kpi-foot">chamados registrados</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${icon('clock')} Em andamento</div>
        <div class="kpi-value blue">${resumo.em_andamento}</div>
        <div class="kpi-foot">requerem acompanhamento</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${icon('check-circle')} Finalizados</div>
        <div class="kpi-value accent">${resumo.finalizados}</div>
        <div class="kpi-foot">concluídos</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${icon('list')} Hoje</div>
        <div class="kpi-value amber">${resumo.hoje}</div>
        <div class="kpi-foot">atendimentos do dia</div>
      </div>
    </div>

    <div class="dashboard-grid mt-16">
      <div class="stack">
        <section class="panel" aria-labelledby="recentes-title">
          <div class="panel-head">
            <h2 id="recentes-title">Chamados recentes</h2>
            <a class="btn btn-ghost btn-sm" href="#/chamados">Ver todos ${icon('chevron-right')}</a>
          </div>
          ${recentesHtml}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Fluxo do atendimento</h2><span class="hint">4 etapas</span></div>
          <div class="panel-body">
            <div class="workflow-list">
              <div class="workflow-step">
                <span class="workflow-num">1</span>
                <div><strong>Abrir o chamado</strong><span>Registre a OS, a comarca e o relato do usuário.</span></div>
              </div>
              <div class="workflow-step">
                <span class="workflow-num">2</span>
                <div><strong>Vincular equipamentos</strong><span>Adicione patrimônios verificados, retirados ou instalados.</span></div>
              </div>
              <div class="workflow-step">
                <span class="workflow-num">3</span>
                <div><strong>Registrar troca</strong><span>Documente a movimentação entre equipamentos quando houver.</span></div>
              </div>
              <div class="workflow-step">
                <span class="workflow-num">4</span>
                <div><strong>Emitir documentos</strong><span>Gere o laudo ou romaneio e mantenha o snapshot no chamado.</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="panel">
          <div class="panel-head"><h2>Ações rápidas</h2></div>
          <div class="panel-body quick-stack">
            <a class="quick" href="#/chamados/novo">
              <span class="quick-icon accent">${icon('plus')}</span>
              <div><strong>Abrir chamado</strong><span>Registrar um novo atendimento.</span></div>
            </a>
            <a class="quick" href="#/chamados?status=EM_ANDAMENTO">
              <span class="quick-icon blue">${icon('clock')}</span>
              <div><strong>Em andamento</strong><span>Ver atendimentos que precisam de retorno.</span></div>
            </a>
            <button class="quick" type="button" data-action="atualizar-painel">
              <span class="quick-icon">${icon('refresh')}</span>
              <div><strong>Atualizar painel</strong><span>Buscar os números mais recentes.</span></div>
            </button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Resumo por status</h2></div>
          <div class="panel-body">
            <div class="info-list">
              <div class="info-row"><span class="info-key">Abertos</span><span class="info-val">${resumo.abertos}</span></div>
              <div class="info-row"><span class="info-key">Em andamento</span><span class="info-val">${resumo.em_andamento}</span></div>
              <div class="info-row"><span class="info-key">Finalizados</span><span class="info-val">${resumo.finalizados}</span></div>
            </div>
            <div class="callout callout-info mt-16">
              ${icon('shield')}
              <div><strong>Histórico rastreável.</strong> Cada etapa fica vinculada ao chamado e ao responsável.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  setView(html, token);
}

/* ---------- Lista de chamados ---------- */

async function renderChamados(token, query) {
  const filtros = {
    busca: (query.get('busca') || '').trim(),
    status: query.get('status') || '',
    tipo: query.get('tipo') || '',
    page: Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1),
  };

  const params = new URLSearchParams();
  if (filtros.busca) params.set('busca', filtros.busca);
  if (filtros.status) params.set('status', filtros.status);
  if (filtros.tipo) params.set('tipo', filtros.tipo);
  params.set('page', String(filtros.page));
  params.set('limit', '20');

  const result = await api(`/api/chamados?${params.toString()}`);
  if (token !== state.renderToken) return;

  const rows = result.data || [];
  const meta = result.meta || { page: filtros.page, limit: 20, total: rows.length };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const listaHtml = rows.length
    ? `<div class="record-list">${rows.map(recordHtml).join('')}</div>`
    : emptyState(
        'Nenhum chamado encontrado',
        'Ajuste os filtros ou abra um novo chamado.',
        '<a class="btn btn-primary btn-sm" href="#/chamados/novo">Abrir chamado</a>'
      );

  const previous = meta.page > 1
    ? `<a class="btn btn-secondary btn-sm" href="${listHash(filtros, meta.page - 1)}">${icon('arrow-left')} Anterior</a>`
    : `<button class="btn btn-secondary btn-sm" type="button" disabled>${icon('arrow-left')} Anterior</button>`;
  const next = meta.page < totalPages
    ? `<a class="btn btn-secondary btn-sm" href="${listHash(filtros, meta.page + 1)}">Próxima ${icon('chevron-right')}</a>`
    : `<button class="btn btn-secondary btn-sm" type="button" disabled>Próxima ${icon('chevron-right')}</button>`;

  const html = `
    <div class="page-head">
      <div class="page-head-main">
        <div class="eyebrow">Operação</div>
        <h1>Chamados</h1>
        <p class="lede">${state.user.papel === 'ADMIN' ? 'Todos os atendimentos da operação.' : 'Seus atendimentos registrados no console.'}</p>
      </div>
      <div class="page-head-actions">
        <a class="btn btn-primary" href="#/chamados/novo">${icon('plus')} Novo chamado</a>
      </div>
    </div>

    <section class="panel filter-panel">
      <div class="panel-body">
        <form id="form-filtros" class="toolbar">
          <div class="field field-search">
            <label class="field-label" for="filtro-busca">Buscar</label>
            <input class="input" id="filtro-busca" name="busca" type="search" value="${escapeHtml(filtros.busca)}" placeholder="OS, setor, contato ou defeito">
          </div>
          <div class="field">
            <label class="field-label" for="filtro-status">Status</label>
            <select class="select" id="filtro-status" name="status">
              <option value="">Todos</option>
              ${optionList([['ABERTO', 'Aberto'], ['EM_ANDAMENTO', 'Em andamento'], ['FINALIZADO', 'Finalizado']], filtros.status)}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="filtro-tipo">Tipo</label>
            <select class="select" id="filtro-tipo" name="tipo">
              <option value="">Todos</option>
              ${optionList([['IN', 'Instalação'], ['TR', 'Troca'], ['REQ', 'Requisição']], filtros.tipo)}
            </select>
          </div>
          <div class="toolbar-actions">
            <button class="btn btn-primary" type="submit">${icon('search')} Filtrar</button>
            <button class="btn btn-secondary" type="button" data-action="limpar-filtros">Limpar</button>
          </div>
        </form>
      </div>
    </section>

    <section class="panel mt-16">
      <div class="panel-head">
        <h2>Resultados</h2>
        <span class="hint">${meta.total} chamado${meta.total === 1 ? '' : 's'}</span>
      </div>
      ${listaHtml}
      <div class="panel-foot pagination">
        <span class="pagination-info">Página ${meta.page} de ${totalPages}</span>
        <div class="pagination-actions">${previous}${next}</div>
      </div>
    </section>
  `;

  setView(html, token);
}

/* ---------- Novo chamado ---------- */

async function renderNovoChamado(token) {
  const result = await api('/api/comarcas');
  if (token !== state.renderToken) return;

  const comarcas = result.data || [];
  if (!comarcas.length) {
    setView(
      `<div class="page-head"><div class="page-head-main"><div class="eyebrow">Novo chamado</div><h1>Comarcas indisponíveis</h1></div></div>${errorPanel('Nenhuma comarca ativa foi encontrada. Execute o seed do banco antes de abrir um chamado.', true)}`,
      token
    );
    return;
  }

  const comarcaOptions = comarcas
    .map((comarca) => `<option value="${comarca.id}">${escapeHtml(comarca.nome)}</option>`)
    .join('');

  const html = `
    <div class="page-head">
      <div class="page-head-main">
        <div class="breadcrumb"><a href="#/chamados">${icon('arrow-left')} Chamados</a> ${icon('chevron-right')} <span>Novo</span></div>
        <div class="eyebrow">Abertura</div>
        <h1>Novo chamado</h1>
        <p class="lede">Registre a OS e os dados do atendimento. O chamado será vinculado ao seu usuário.</p>
      </div>
    </div>

    <form id="form-chamado" class="stack">
      <div id="form-chamado-error" class="error-panel" role="alert" hidden></div>

      <section class="panel">
        <div class="panel-head"><h2>Identificação</h2><span class="hint">Campos com * são obrigatórios</span></div>
        <div class="panel-body form-grid">
          <div class="field-row-3">
            <div class="field">
              <label class="label" for="chamado-os">Número da OS <span class="req">*</span></label>
              <input class="input mono-input" id="chamado-os" name="numero_os" type="text" maxlength="30" placeholder="TR1185398" required autocomplete="off">
            </div>
            <div class="field">
              <label class="label" for="chamado-tipo">Tipo <span class="req">*</span></label>
              <select class="select" id="chamado-tipo" name="tipo" required>
                ${optionList([['IN', 'Instalação'], ['TR', 'Troca'], ['REQ', 'Requisição']], 'IN')}
              </select>
            </div>
            <div class="field">
              <label class="label" for="chamado-data">Data do atendimento <span class="req">*</span></label>
              <input class="input" id="chamado-data" name="data_atendimento" type="date" value="${todayLocal()}" required>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label" for="chamado-comarca">Comarca <span class="req">*</span></label>
              <select class="select" id="chamado-comarca" name="comarca_id" required>
                <option value="">Selecione a comarca</option>
                ${comarcaOptions}
              </select>
            </div>
            <div class="field">
              <label class="label" for="chamado-setor">Setor / local</label>
              <input class="input" id="chamado-setor" name="setor" type="text" maxlength="100" placeholder="Sala Polo, fórum, gabinete…">
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Contato no local</h2></div>
        <div class="panel-body form-grid">
          <div class="field-row-3">
            <div class="field">
              <label class="label" for="chamado-contato">Pessoa de contato</label>
              <input class="input" id="chamado-contato" name="pessoa_contato" type="text" maxlength="100" placeholder="Nome de quem recebeu o atendimento">
            </div>
            <div class="field">
              <label class="label" for="chamado-matricula">Matrícula</label>
              <input class="input mono-input" id="chamado-matricula" name="matricula_contato" type="text" maxlength="20" placeholder="Opcional">
            </div>
            <div class="field">
              <label class="label" for="chamado-telefone">Telefone</label>
              <input class="input" id="chamado-telefone" name="telefone_contato" type="tel" maxlength="30" placeholder="(37) 99999-0000">
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Relato técnico</h2></div>
        <div class="panel-body form-grid">
          <div class="field">
            <label class="label" for="chamado-defeito">Defeito relatado <span class="req">*</span></label>
            <textarea class="textarea" id="chamado-defeito" name="defeito_relatado" maxlength="10000" placeholder="Descreva o problema informado pelo usuário." required></textarea>
          </div>
          <div class="field">
            <label class="label" for="chamado-observacoes">Observações iniciais <span class="opt">opcional</span></label>
            <textarea class="textarea" id="chamado-observacoes" name="observacoes" maxlength="10000" placeholder="Informações complementares do atendimento."></textarea>
          </div>
        </div>
      </section>

      <div class="form-actions">
        <a class="btn btn-secondary" href="#/chamados">Cancelar</a>
        <button class="btn btn-primary" type="submit">${icon('check')} Abrir chamado</button>
      </div>
    </form>
  `;

  setView(html, token);
}

/* ---------- Detalhe do chamado ---------- */

function equipamentoRow(equipamento) {
  const locais = [];
  if (equipamento.local_retirada) locais.push(`Retirada: ${escapeHtml(equipamento.local_retirada)}`);
  if (equipamento.local_entrega) locais.push(`Entrega: ${escapeHtml(equipamento.local_entrega)}`);
  const locaisHtml = locais.length
    ? `<div class="equipment-sub">${locais.join(' · ')}</div>`
    : '';

  return `
    <div class="equipment-row">
      <div class="equipment-main">
        <div class="equipment-title">
          <span class="mono">${escapeHtml(equipamento.patrimonio || 'Sem patrimônio')}</span>
          <span class="badge">${escapeHtml(acaoLabel(equipamento.acao))}</span>
          ${equipamento.tipo_movimentacao ? `<span class="badge badge-amber">${escapeHtml(movimentacaoLabel(equipamento.tipo_movimentacao))}</span>` : ''}
        </div>
        <div class="equipment-sub">
          ${escapeHtml([equipamento.tipo_equipamento, equipamento.modelo, equipamento.fabricante].filter(Boolean).join(' · ') || 'Equipamento sem descrição')}
          ${equipamento.serial ? ` · Serial ${escapeHtml(equipamento.serial)}` : ''}
        </div>
        ${locaisHtml}
      </div>
      <div class="equipment-actions">
        <button class="icon-btn" type="button" data-action="excluir-equipamento" data-id="${equipamento.id}" title="Remover equipamento" aria-label="Remover equipamento">
          ${icon('trash')}
        </button>
      </div>
    </div>
  `;
}

function trocaRow(troca) {
  const retirado = troca.retirado_patrimonio || '—';
  const instalado = troca.instalado_patrimonio || '—';
  return `
    <div class="doc-row">
      <div class="doc-row-main">
        <span class="doc-icon">${icon('refresh')}</span>
        <div>
          <div class="doc-title">${escapeHtml(retirado)} → ${escapeHtml(instalado)}</div>
          <div class="doc-sub">${escapeHtml(formatDate(troca.data_troca))}${troca.local_retirada ? ` · ${escapeHtml(troca.local_retirada)}` : ''}${troca.local_entrega ? ` → ${escapeHtml(troca.local_entrega)}` : ''}</div>
          ${troca.observacoes ? `<div class="doc-snapshot">${escapeHtml(troca.observacoes)}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

function documentoRow(documento) {
  const dados = documento.dados || {};
  const base = dados.dados && typeof dados.dados === 'object' ? dados.dados : dados;
  const resumo = base.tarefa
    ? `OS ${base.tarefa}`
    : base.os
      ? `OS ${base.os}`
      : 'Snapshot do chamado';
  return `
    <div class="doc-row">
      <div class="doc-row-main">
        <span class="doc-icon">${icon('file')}</span>
        <div>
          <div class="doc-title">${escapeHtml(documentoLabel(documento.tipo_doc))}</div>
          <div class="doc-sub">${escapeHtml(formatDateTime(documento.gerado_em))} · ${escapeHtml(resumo)}</div>
        </div>
      </div>
      <span class="badge">${escapeHtml(documento.tipo_doc)}</span>
    </div>
  `;
}

function draftFromChamado(chamado) {
  const equipamentos = chamado.equipamentos || [];
  const trocas = chamado.trocas || [];
  const troca = trocas[0] || null;
  const retirado = troca?.equip_retirado_id
    ? equipamentos.find((equipamento) => equipamento.id === troca.equip_retirado_id)
    : null;
  const principal =
    retirado ||
    equipamentos.find((equipamento) => ['RETIRADA', 'TROCA'].includes(equipamento.acao)) ||
    equipamentos[0] ||
    {};

  const manutencao = principal.tipo_movimentacao === 'MANUTENCAO';
  const destino = manutencao ? 'Manutenção' : 'Estoque';
  const retirada = [...new Set([principal.local_retirada, chamado.setor].filter(Boolean))].join(' / ');

  return {
    versao: 1,
    dados: {
      comarcaAtendimento: chamado.comarca_nome || '',
      patrimonio: principal.patrimonio || '',
      tarefa: chamado.numero_os || '',
      data: chamado.data_atendimento || '',
      movimento: manutencao ? 'Manutenção' : 'Devolução',
      verificacao: principal.local_verificacao || '',
      retirada,
      entrega: principal.local_entrega || 'Sala Polo Divinópolis',
      serie: principal.serial || '',
      modelo: principal.modelo || '',
      fabricante: principal.fabricante || '',
      outros: '',
      justificativa: chamado.defeito_relatado || '',
      outroItem: '',
      avarias: 'Não',
      quais: '',
      observacoes: chamado.observacoes || '',
      destino,
      comarca: manutencao ? '' : (chamado.comarca_nome || ''),
      a0: false,
      a1: false,
      a2: false,
      a3: false,
      a4: false,
      a5: false,
      c0: 'Bom',
      c1: 'Bom',
      c2: 'Bom',
      c3: 'Bom',
      c4: 'Bom',
      c5: 'Bom',
    },
  };
}

function baixarRascunho(chamado) {
  const draft = draftFromChamado(chamado);
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const os = String(chamado.numero_os || 'chamado').replace(/[^\w.-]+/g, '-');
  link.href = url;
  link.download = `wyntech-laudo-${os}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast('Rascunho oficial baixado. Importe no gerador do Apps Script.');
}

async function renderDetalheChamado(token, id) {
  const result = await api(`/api/chamados/${encodeURIComponent(id)}`);
  if (token !== state.renderToken) return;

  const chamado = result.data;
  state.chamadoAtual = chamado;
  document.title = `Chamado ${chamado.numero_os} · Wyntech Campo TJMG`;
  if (els.topbarContext) els.topbarContext.textContent = 'Chamado';

  const equipamentos = chamado.equipamentos || [];
  const trocas = chamado.trocas || [];
  const documentos = chamado.documentos || [];
  const officialUrl = state.config.officialLaudoUrl;

  const equipamentosHtml = equipamentos.length
    ? `<div class="equipment-list">${equipamentos.map(equipamentoRow).join('')}</div>`
    : emptyState('Nenhum equipamento vinculado', 'Adicione o patrimônio verificado, retirado ou instalado neste chamado.');

  const trocasHtml = trocas.length
    ? `<div class="doc-list">${trocas.map(trocaRow).join('')}</div>`
    : emptyState('Nenhuma troca registrada', 'Registre a movimentação quando houver substituição de equipamento.');

  const documentosHtml = documentos.length
    ? `<div class="doc-list">${documentos.map(documentoRow).join('')}</div>`
    : emptyState('Nenhum documento registrado', 'Registre a emissão do laudo ou romaneio para manter o histórico.');

  const equipamentoOptions = equipamentos
    .map((equipamento) => [String(equipamento.id), `${equipamento.patrimonio || 'Sem patrimônio'} — ${equipamento.modelo || equipamento.tipo_equipamento || 'equipamento'}`])
    .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
    .join('');

  const html = `
    <div class="page-head">
      <div class="page-head-main">
        <div class="breadcrumb"><a href="#/chamados">${icon('arrow-left')} Chamados</a> ${icon('chevron-right')} <span>${escapeHtml(chamado.numero_os)}</span></div>
        <div class="eyebrow">${escapeHtml(tipoLabel(chamado.tipo))}</div>
        <h1>${escapeHtml(chamado.numero_os)} ${statusBadge(chamado.status)}</h1>
        <p class="lede">${escapeHtml(chamado.comarca_nome)} · ${escapeHtml(formatDate(chamado.data_atendimento))} · Responsável: ${escapeHtml(chamado.usuario_nome)}</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-primary" type="button" data-action="mostrar-equipamento">${icon('plus')} Adicionar equipamento</button>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-stack">
        <section class="panel">
          <div class="panel-head"><h2>Dados do atendimento</h2></div>
          <div class="panel-body">
            <div class="data-grid">
              ${dataItem('OS', chamado.numero_os, { mono: true })}
              ${dataItem('Tipo', tipoLabel(chamado.tipo))}
              ${dataItem('Status', statusLabel(chamado.status))}
              ${dataItem('Data', formatDate(chamado.data_atendimento))}
              ${dataItem('Comarca', chamado.comarca_nome)}
              ${dataItem('Setor', chamado.setor)}
              ${dataItem('Contato', chamado.pessoa_contato)}
              ${dataItem('Matrícula', chamado.matricula_contato)}
              ${dataItem('Telefone', chamado.telefone_contato)}
              ${dataItem('Técnico', chamado.usuario_nome)}
              ${dataItem('Defeito relatado', chamado.defeito_relatado, { wide: true, pre: true })}
              ${dataItem('Solução aplicada', chamado.solucao_aplicada, { wide: true, pre: true })}
              ${dataItem('Observações', chamado.observacoes, { wide: true, pre: true })}
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Equipamentos <span class="hint">${equipamentos.length}</span></h2>
            <button class="btn btn-secondary btn-sm" type="button" data-action="mostrar-equipamento">${icon('plus')} Adicionar</button>
          </div>
          ${equipamentosHtml}
          <form id="form-equipamento" class="inline-form" data-chamado-id="${chamado.id}" hidden>
            <div class="inline-form-title">
              <h3>Adicionar equipamento</h3>
              <button class="icon-btn" type="button" data-action="cancelar-equipamento" title="Fechar" aria-label="Fechar">${icon('x')}</button>
            </div>
            <div class="error-panel" data-form-error hidden></div>
            <div class="form-grid">
              <div class="field-row">
                <div class="field">
                  <label class="label" for="eq-patrimonio">Patrimônio</label>
                  <input class="input mono-input" id="eq-patrimonio" name="patrimonio" type="text" maxlength="30" placeholder="100309615">
                </div>
                <div class="field">
                  <label class="label" for="eq-serial">Serial</label>
                  <input class="input mono-input" id="eq-serial" name="serial" type="text" maxlength="50" placeholder="SN-0001">
                </div>
              </div>
              <div class="field-row-3">
                <div class="field">
                  <label class="label" for="eq-tipo">Tipo</label>
                  <input class="input" id="eq-tipo" name="tipo_equipamento" type="text" maxlength="50" placeholder="Desktop, monitor…">
                </div>
                <div class="field">
                  <label class="label" for="eq-modelo">Modelo</label>
                  <input class="input" id="eq-modelo" name="modelo" type="text" maxlength="80" placeholder="OptiPlex 7080">
                </div>
                <div class="field">
                  <label class="label" for="eq-fabricante">Fabricante</label>
                  <input class="input" id="eq-fabricante" name="fabricante" type="text" maxlength="50" placeholder="Dell">
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label class="label" for="eq-acao">Ação <span class="req">*</span></label>
                  <select class="select" id="eq-acao" name="acao" required>
                    ${optionList([['VERIFICACAO', 'Verificação'], ['RETIRADA', 'Retirada'], ['INSTALACAO', 'Instalação'], ['TROCA', 'Troca']], 'VERIFICACAO')}
                  </select>
                </div>
                <div class="field">
                  <label class="label" for="eq-movimentacao">Movimentação <span class="opt">opcional</span></label>
                  <select class="select" id="eq-movimentacao" name="tipo_movimentacao">
                    <option value="">Não se aplica</option>
                    ${optionList([['MANUTENCAO', 'Manutenção'], ['DEVOLUCAO', 'Devolução']], '')}
                  </select>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label class="label" for="eq-retirada">Local de retirada</label>
                  <input class="input" id="eq-retirada" name="local_retirada" type="text" maxlength="150" placeholder="Sala Polo">
                </div>
                <div class="field">
                  <label class="label" for="eq-entrega">Local de entrega</label>
                  <input class="input" id="eq-entrega" name="local_entrega" type="text" maxlength="150" value="Sala Polo Divinópolis">
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" type="button" data-action="cancelar-equipamento">Cancelar</button>
              <button class="btn btn-primary" type="submit">${icon('check')} Adicionar equipamento</button>
            </div>
          </form>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Trocas <span class="hint">${trocas.length}</span></h2>
            ${equipamentos.length ? `<button class="btn btn-secondary btn-sm" type="button" data-action="mostrar-troca">${icon('plus')} Registrar troca</button>` : ''}
          </div>
          ${trocasHtml}
          ${equipamentos.length ? `
            <form id="form-troca" class="inline-form" data-chamado-id="${chamado.id}" hidden>
              <div class="inline-form-title">
                <h3>Registrar troca</h3>
                <button class="icon-btn" type="button" data-action="cancelar-troca" title="Fechar" aria-label="Fechar">${icon('x')}</button>
              </div>
              <div class="error-panel" data-form-error hidden></div>
              <div class="form-grid">
                <div class="field-row">
                  <div class="field">
                    <label class="label" for="troca-retirado">Equipamento retirado</label>
                    <select class="select" id="troca-retirado" name="equip_retirado_id">
                      <option value="">Nenhum</option>
                      ${equipamentoOptions}
                    </select>
                  </div>
                  <div class="field">
                    <label class="label" for="troca-instalado">Equipamento instalado</label>
                    <select class="select" id="troca-instalado" name="equip_instalado_id">
                      <option value="">Nenhum</option>
                      ${equipamentoOptions}
                    </select>
                  </div>
                </div>
                <div class="field-row-3">
                  <div class="field">
                    <label class="label" for="troca-data">Data</label>
                    <input class="input" id="troca-data" name="data_troca" type="date" value="${todayLocal()}">
                  </div>
                  <div class="field">
                    <label class="label" for="troca-retirada">Local de retirada</label>
                    <input class="input" id="troca-retirada" name="local_retirada" type="text" maxlength="150" placeholder="Sala Polo">
                  </div>
                  <div class="field">
                    <label class="label" for="troca-entrega">Local de entrega</label>
                    <input class="input" id="troca-entrega" name="local_entrega" type="text" maxlength="150" value="Sala Polo Divinópolis">
                  </div>
                </div>
                <div class="field">
                  <label class="label" for="troca-obs">Observações</label>
                  <textarea class="textarea" id="troca-obs" name="observacoes" maxlength="10000" placeholder="Informações da troca."></textarea>
                </div>
              </div>
              <div class="form-actions">
                <button class="btn btn-secondary" type="button" data-action="cancelar-troca">Cancelar</button>
                <button class="btn btn-primary" type="submit">${icon('check')} Registrar troca</button>
              </div>
            </form>
          ` : ''}
        </section>
      </div>

      <div class="detail-stack">
        <section class="panel">
          <div class="panel-head"><h2>Ações do chamado</h2></div>
          <div class="panel-body">
            <div class="status-actions">
              ${['ABERTO', 'EM_ANDAMENTO', 'FINALIZADO'].map((status) => `
                <button class="btn btn-secondary ${chamado.status === status ? 'is-current' : ''}" type="button" data-action="alterar-status" data-status="${status}" ${chamado.status === status ? 'disabled' : ''}>
                  ${chamado.status === status ? icon('check') : icon('refresh')} ${escapeHtml(statusLabel(status))}
                </button>
              `).join('')}
            </div>
            <div class="btn-row mt-16">
              <button class="btn btn-danger btn-sm" type="button" data-action="excluir-chamado">${icon('trash')} Excluir chamado</button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Documentos <span class="hint">${documentos.length}</span></h2></div>
          <div class="panel-body">
            ${documentosHtml}
            <div class="btn-row mt-16">
              <button class="btn btn-secondary btn-sm" type="button" data-action="registrar-documento" data-tipo="LAUDO">Laudo</button>
              <button class="btn btn-secondary btn-sm" type="button" data-action="registrar-documento" data-tipo="LAUDO_ROLLOUT">Rollout</button>
              <button class="btn btn-secondary btn-sm" type="button" data-action="registrar-documento" data-tipo="ROMANEIO">Romaneio</button>
            </div>
            <div class="btn-row mt-8">
              <button class="btn btn-primary btn-sm" type="button" data-action="baixar-rascunho">${icon('file')} Baixar rascunho</button>
              ${officialUrl
                ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">${icon('external')} Gerador oficial</a>`
                : `<button class="btn btn-ghost btn-sm" type="button" disabled title="Configure OFFICIAL_LAUDO_URL no servidor">${icon('external')} Gerador não configurado</button>`}
            </div>
            <p class="hint-text mt-12">O rascunho segue o contrato <span class="mono">{versao:1,dados:{...}}</span> e pode ser importado no gerador oficial. Acessórios e checklist ainda devem ser conferidos no gerador. ${officialUrl ? '' : 'O atalho do gerador é configurado no servidor.'}</p>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Responsável</h2></div>
          <div class="panel-body">
            <div class="info-list">
              <div class="info-row"><span class="info-key">Técnico</span><span class="info-val">${escapeHtml(chamado.usuario_nome)}</span></div>
              <div class="info-row"><span class="info-key">Comarca</span><span class="info-val">${escapeHtml(chamado.comarca_nome)}</span></div>
              <div class="info-row"><span class="info-key">Criado em</span><span class="info-val">${escapeHtml(formatDateTime(chamado.criado_em))}</span></div>
              <div class="info-row"><span class="info-key">Atualizado em</span><span class="info-val">${escapeHtml(formatDateTime(chamado.atualizado_em))}</span></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  setView(html, token);
}

/* ---------- Meu perfil ---------- */

async function renderPerfil(token) {
  const user = state.user;
  const html = `
    <div class="page-head">
      <div class="page-head-main">
        <div class="eyebrow">Conta</div>
        <h1>Meu perfil</h1>
        <p class="lede">Dados do seu acesso e troca da senha pessoal.</p>
      </div>
      <div class="page-head-actions">
        <a class="btn btn-secondary" href="#/">${icon('arrow-left')} Voltar ao painel</a>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-stack">
        <section class="panel">
          <div class="panel-head"><h2>Dados do usuário</h2><span class="badge">${escapeHtml(paperLabel(user))}</span></div>
          <div class="panel-body">
            <div class="data-grid">
              ${dataItem('Nome', user.nome)}
              ${dataItem('E-mail', user.email)}
              ${dataItem('Matrícula', user.matricula)}
              ${dataItem('Cargo', user.cargo)}
              ${dataItem('Papel', paperLabel(user))}
              ${dataItem('Conta criada em', formatDateTime(user.criado_em))}
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Segurança</h2></div>
          <div class="panel-body">
            <div class="callout callout-info">
              ${icon('shield')}
              <div><strong>Troca de senha com encerramento de sessões.</strong> Ao salvar uma nova senha, as demais sessões deste usuário são revogadas. A sessão atual permanece ativa.</div>
            </div>
            <p class="hint-text mt-12">A senha deve ter pelo menos 8 caracteres. Evite reutilizar a senha inicial de demonstração em produção.</p>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Sobre o console</h2></div>
          <div class="panel-body">
            <div class="info-list">
              <div class="info-row"><span class="info-key">Versão da API</span><span class="info-val">${escapeHtml(state.config.version || '—')}</span></div>
              <div class="info-row"><span class="info-key">Banco de dados</span><span class="info-val">SQLite</span></div>
              <div class="info-row"><span class="info-key">Gerador oficial</span><span class="info-val">${state.config.officialLaudoUrl ? 'Configurado' : 'Não configurado'}</span></div>
            </div>
            <p class="hint-text mt-12">A sessão usa cookie HttpOnly e a API responde pelo mesmo domínio do console. O rascunho do gerador é baixado localmente.</p>
          </div>
        </section>
      </div>

      <div class="detail-stack">
        <section class="panel">
          <div class="panel-head"><h2>Alterar senha</h2></div>
          <div class="panel-body">
            <form id="form-senha">
              <div class="error-panel" data-form-error role="alert" hidden></div>
              <div class="form-grid">
                <div class="field">
                  <label class="label" for="senha-atual">Senha atual <span class="req">*</span></label>
                  <input class="input" id="senha-atual" name="senha_atual" type="password" autocomplete="current-password" minlength="8" required>
                </div>
                <div class="field">
                  <label class="label" for="senha-nova">Nova senha <span class="req">*</span></label>
                  <input class="input" id="senha-nova" name="nova_senha" type="password" autocomplete="new-password" minlength="8" required>
                </div>
                <div class="field">
                  <label class="label" for="senha-confirmar">Confirmar nova senha <span class="req">*</span></label>
                  <input class="input" id="senha-confirmar" name="confirmar_senha" type="password" autocomplete="new-password" minlength="8" required>
                </div>
              </div>
              <div class="form-actions">
                <button class="btn btn-primary" type="submit">${icon('key')} Salvar nova senha</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  `;

  setView(html, token);
}

/* ---------- Ações de tela ---------- */

function showFormError(form, message) {
  const box = form.querySelector('[data-form-error]');
  if (box) {
    box.hidden = false;
    box.textContent = message || 'Não foi possível concluir.';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    showToast(message || 'Não foi possível concluir.', 'error');
  }
}

function hideFormError(form) {
  const box = form?.querySelector('[data-form-error]');
  if (box) {
    box.hidden = true;
    box.textContent = '';
  }
}

async function handleViewClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  if (!action) return;
  event.preventDefault();

  if (action === 'atualizar-painel' || action === 'recarregar') {
    await renderRoute();
    return;
  }

  if (action === 'limpar-filtros') {
    const hash = '#/chamados';
    if (window.location.hash === hash) await renderRoute();
    else window.location.hash = hash;
    return;
  }

  if (action === 'mostrar-equipamento') {
    const form = document.getElementById('form-equipamento');
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) {
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      form.querySelector('input')?.focus();
    }
    return;
  }

  if (action === 'cancelar-equipamento') {
    const form = document.getElementById('form-equipamento');
    if (form) form.hidden = true;
    return;
  }

  if (action === 'mostrar-troca') {
    const form = document.getElementById('form-troca');
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) {
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      form.querySelector('select')?.focus();
    }
    return;
  }

  if (action === 'cancelar-troca') {
    const form = document.getElementById('form-troca');
    if (form) form.hidden = true;
    return;
  }

  if (action === 'alterar-status') {
    const chamado = state.chamadoAtual;
    const status = target.dataset.status;
    if (!chamado || !status || chamado.status === status) return;
    setBusy(target, true, 'Atualizando…');
    try {
      await api(`/api/chamados/${chamado.id}`, { method: 'PUT', body: { status } });
      showToast(`Status alterado para ${statusLabel(status)}.`);
      await renderRoute();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(target, false);
    }
    return;
  }

  if (action === 'excluir-chamado') {
    const chamado = state.chamadoAtual;
    if (!chamado) return;
    if (!window.confirm(`Excluir o chamado ${chamado.numero_os}? Ele sairá da listagem, mas o histórico permanece no banco.`)) return;
    setBusy(target, true, 'Excluindo…');
    try {
      await api(`/api/chamados/${chamado.id}`, { method: 'DELETE' });
      showToast('Chamado excluído da listagem.');
      window.location.hash = '#/chamados';
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(target, false);
    }
    return;
  }

  if (action === 'excluir-equipamento') {
    const id = target.dataset.id;
    if (!id || !window.confirm('Remover este equipamento do chamado?')) return;
    setBusy(target, true, '');
    try {
      await api(`/api/equipamentos/${id}`, { method: 'DELETE' });
      showToast('Equipamento removido.');
      await renderRoute();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(target, false);
    }
    return;
  }

  if (action === 'registrar-documento') {
    const chamado = state.chamadoAtual;
    const tipo = target.dataset.tipo;
    if (!chamado || !tipo) return;
    setBusy(target, true, 'Registrando…');
    try {
      await api(`/api/chamados/${chamado.id}/documentos`, {
        method: 'POST',
        body: { tipo_doc: tipo, dados: draftFromChamado(chamado) },
      });
      showToast(`${documentoLabel(tipo)} registrado.`);
      await renderRoute();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(target, false);
    }
    return;
  }

  if (action === 'baixar-rascunho') {
    if (!state.chamadoAtual) return;
    baixarRascunho(state.chamadoAtual);
  }
}

async function handleViewSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();

  if (form.id === 'form-filtros') {
    const data = new FormData(form);
    const filtros = {
      busca: String(data.get('busca') || '').trim(),
      status: String(data.get('status') || ''),
      tipo: String(data.get('tipo') || ''),
    };
    const hash = listHash(filtros, 1);
    if (window.location.hash === hash) await renderRoute();
    else window.location.hash = hash;
    return;
  }

  if (form.id === 'form-senha') {
    const button = form.querySelector('button[type="submit"]');
    hideFormError(form);
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.nova_senha !== data.confirmar_senha) {
      showFormError(form, 'A confirmação da nova senha não confere.');
      return;
    }
    if (String(data.nova_senha).length < 8) {
      showFormError(form, 'A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    setBusy(button, true, 'Salvando…');
    try {
      await api('/api/auth/alterar-senha', {
        method: 'POST',
        body: {
          senha_atual: data.senha_atual,
          nova_senha: data.nova_senha,
        },
      });
      form.reset();
      showToast('Senha alterada. As demais sessões foram encerradas.');
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setBusy(button, false);
    }
    return;
  }

  if (form.id === 'form-chamado') {
    const button = form.querySelector('button[type="submit"]');
    hideFormError(form);
    setBusy(button, true, 'Abrindo…');
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const result = await api('/api/chamados', { method: 'POST', body: data });
      showToast('Chamado aberto com sucesso.');
      window.location.hash = `#/chamados/${result.data.id}`;
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setBusy(button, false);
    }
    return;
  }

  if (form.id === 'form-equipamento') {
    const button = form.querySelector('button[type="submit"]');
    hideFormError(form);
    setBusy(button, true, 'Adicionando…');
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      await api(`/api/chamados/${form.dataset.chamadoId}/equipamentos`, {
        method: 'POST',
        body: data,
      });
      showToast('Equipamento adicionado.');
      await renderRoute();
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setBusy(button, false);
    }
    return;
  }

  if (form.id === 'form-troca') {
    const button = form.querySelector('button[type="submit"]');
    hideFormError(form);
    setBusy(button, true, 'Registrando…');
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      await api(`/api/chamados/${form.dataset.chamadoId}/trocas`, {
        method: 'POST',
        body: data,
      });
      showToast('Troca registrada.');
      await renderRoute();
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setBusy(button, false);
    }
  }
}

/* ---------- Inicialização ---------- */

function bindEvents() {
  els.loginForm.addEventListener('submit', doLogin);
  document.getElementById('logout-desktop').addEventListener('click', doLogout);
  document.getElementById('logout-mobile').addEventListener('click', doLogout);
  document.getElementById('logout-bottom').addEventListener('click', doLogout);

  els.view.addEventListener('click', (event) => {
    handleViewClick(event).catch((error) => showToast(error.message, 'error'));
  });
  els.view.addEventListener('submit', (event) => {
    handleViewSubmit(event).catch((error) => showToast(error.message, 'error'));
  });

  window.addEventListener('hashchange', () => {
    if (state.user) renderRoute();
  });
}

function init() {
  bindEvents();
  bootstrap();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
