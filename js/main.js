// LÓGICA DE TODAS AS TELAS. Cada página HTML tem <body data-page="nome">, e no final deste arquivo escolhemos a função certa para ela.
/* AgendaFácil: lógica das páginas. Cada página define <body data-page="nome"> */
// Atalho: $('#id') acha o primeiro elemento da página com aquele seletor CSS.
const $ = (s, r = document) => r.querySelector(s);
// Segurança: troca <, >, & e aspas por códigos HTML antes de pôr textos de usuários na tela (evita injeção de código, o XSS).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Nomes dos dias da semana (índice 0 = domingo).
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
// Texto e cor de cada situação da consulta.
const STATUS = { agendado: ['Agendado', ''], concluido: ['Concluído', 'ok'], cancelado: ['Cancelado', 'cancelado'], faltou: ['Faltou', 'cancelado'] };
// Devolve a data de amanhã no formato AAAA-MM-DD.
const amanha = () => { const d = new Date(Date.now() + 864e5); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
// Devolve a data de hoje no formato AAAA-MM-DD.
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
// Converte '2026-11-10' em '10/11/2026'.
const fmtDia = (d) => d.split('-').reverse().join('/');
// Monta o texto de um período de bloqueio (ex.: '10/11/2026 até 15/11/2026').
const fmtPeriodo = (b) => {
  const i = b.inicio, f = b.fim;
  // Início: só a data se o bloqueio começa à meia-noite; senão, data e hora.
  const ini = i.endsWith('T00:00') ? fmtDia(i.slice(0, 10)) : fmtData(i);
  let fim;
  // Fim à meia-noite significa 'dia inteiro': mostra o dia anterior.
  if (f.endsWith('T00:00')) { const d = new Date(f.slice(0, 10) + 'T12:00'); d.setDate(d.getDate() - 1); fim = fmtDia(d.toISOString().slice(0, 10)); }
  else fim = fmtData(f);
  // Se começa e termina no mesmo dia, mostra uma vez só.
  return ini === fim ? ini : `${ini} até ${fim}`;
};
// Converte '2026-11-10T08:40' em '10/11/2026 às 08:40'.
const fmtData = (iso) => { const [d, h] = iso.split('T'); const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y} às ${h.slice(0, 5)}`; };
// Cria a etiqueta colorida com a situação da consulta.
const badge = (st) => `<span class="badge ${STATUS[st][1]}">${STATUS[st][0]}</span>`;

// Guarda o temporizador da mensagem flutuante.
let tAviso;
// Mostra uma mensagem flutuante por 4 segundos.
function aviso(msg) {
  // Se a página não tem o quadro de aviso, usa alert.
  const el = $('#aviso'); if (!el) return alert(msg);
  // Escreve a mensagem e mostra o quadro.
  el.textContent = msg; el.style.display = 'block';
  // Esconde o quadro depois de 4 segundos.
  clearTimeout(tAviso); tAviso = setTimeout(() => (el.style.display = 'none'), 4000);
}
// Protege a tela: se não há login (ou o perfil é outro), redireciona.
function exigirLogin(perfil) {
  // Pega o usuário guardado no navegador.
  const u = usuarioLogado();
  // Sem login: vai para a tela de login.
  if (!u) { location.href = base() + 'pages/login.html'; return null; }
  // Perfil errado: vai para a tela do seu perfil.
  if (perfil && u.perfil !== perfil) { location.href = base() + (u.perfil === 'admin_clinica' ? 'pages/painel.html' : 'pages/agendar.html'); return null; }
  // Devolve o usuário.
  return u;
}
// Desenha a barra do topo conforme quem está logado.
// ===== TEMA CLARO/ESCURO, LOGO E NOME =====
// Nome do produto exibido na barra do topo e no rodapé (mude aqui para trocar o nome no site inteiro).
const NOME_PRODUTO = 'AgendaFácil';
// Desenho (SVG) do logo: um calendário com um 'certo' dentro.
const LOGO_SVG = `<img src="${base()}img/logo-icone-branco.png" alt="" width="28" height="26">`;
// Desenhos da lua (ativar escuro) e do sol (voltar ao claro).
const ICONE_LUA = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICONE_SOL = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
// Lê a escolha salva (ou, se não houver, a preferência do aparelho) e devolve 'claro' ou 'escuro'.
function temaAtual() {
  try { const t = localStorage.getItem('af_tema'); if (t) return t; } catch (e) {}
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}
// Aplica o tema: escreve data-tema na tag <html> (o CSS troca as cores a partir disso).
function aplicarTema(t) { document.documentElement.setAttribute('data-tema', t); }
// Aplica o tema logo ao carregar o script, antes de a página aparecer (evita piscar branco).
aplicarTema(temaAtual());

// ===== MÁSCARAS DOS CAMPOS (CPF, CNPJ e telefone) =====
// Formata os dígitos digitados conforme o molde (cada # é um dígito).
function formatar(valor, molde) {
  const d = valor.replace(/\D/g, ''); let r = '', i = 0;
  for (const c of molde) { if (i >= d.length) break; if (c === '#') r += d[i++]; else r += c; }
  return r;
}
// Telefone: (00) 0000-0000 com 10 dígitos ou (00) 00000-0000 com 11.
function formatarTel(v) { const d = v.replace(/\D/g, '').slice(0, 11); return formatar(d, d.length > 10 ? '(##) #####-####' : '(##) ####-####'); }
// Liga as máscaras nos campos que existirem na página.
function ativarMascaras() {
  const regras = { cpf: (v) => formatar(v.slice(0, 14), '###.###.###-##'), cnpj: (v) => formatar(v.slice(0, 18), '##.###.###/####-##'), tel: formatarTel, telc: formatarTel };
  Object.keys(regras).forEach((id) => {
    const el = document.getElementById(id); if (!el) return;
    el.setAttribute('inputmode', 'numeric'); if (id.startsWith('tel')) el.setAttribute('placeholder', '(00) 00000-0000');
    el.addEventListener('input', () => { el.value = regras[id](el.value); });
  });
}

function renderTopo() {
  // Usuário e prefixos dos links.
  const u = usuarioLogado(), b = base(), p = b + 'pages/';
  // Links do menu comuns a todos.
  let menu = `<a class="link" href="${b}index.html">Início</a><a class="link" href="${p}recursos.html">Recursos</a>`;
  // Botões da direita para quem não está logado (Entrar e Criar conta).
  let acoes = `<a class="link" href="${p}acesso.html?acao=entrar">Entrar</a><a class="btn peq pilula" href="${p}acesso.html?acao=criar">Criar conta</a>`;
  // Paciente: acrescenta Agendar e Meus agendamentos, e troca os botões pelo Sair.
  // Quem está logado também vê o atalho 'Alterar senha'.
  const alterar = u ? `<a class="link" href="${p}alterar-senha.html">Alterar senha</a>` : '';
  if (u && u.perfil === 'paciente') { menu += `<a class="link" href="${p}agendar.html">Agendar</a><a class="link" href="${p}meus-agendamentos.html">Meus agendamentos</a>`; acoes = '<button class="btn sec peq pilula" id="sair">Sair</button>'; }
  // Administrador: acrescenta o Painel da clínica e o botão Sair.
  if (u && u.perfil === 'admin_clinica') { menu += `<a class="link" href="${p}painel.html">Painel da clínica</a>`; acoes = '<button class="btn sec peq pilula" id="sair">Sair</button>'; }
  // Acrescenta 'Alterar senha' ao menu de quem está logado.
  menu += alterar;
  // Escreve a barra no elemento #topo.
  $('#topo').innerHTML = `<nav aria-label="Principal"><a class="marca" href="${b}index.html">${LOGO_SVG}${NOME_PRODUTO}</a><div class="menu">${menu}</div><div class="acoes"><button type="button" class="tema" id="tema"></button>${acoes}</div></nav>`;
  // Botão de tema: mostra a lua (no claro) ou o sol (no escuro) e alterna ao clicar, salvando a escolha.
  const bt = $('#tema');
  const pintar = () => { const e = temaAtual() === 'escuro'; bt.innerHTML = e ? ICONE_SOL : ICONE_LUA; bt.title = e ? 'Usar tema claro' : 'Usar tema escuro'; bt.setAttribute('aria-label', bt.title); };
  bt.onclick = () => { const n = temaAtual() === 'escuro' ? 'claro' : 'escuro'; try { localStorage.setItem('af_tema', n); } catch (e) {} aplicarTema(n); pintar(); };
  pintar();
  // Faixa de aviso: aparece quando a pessoa entrou com uma senha de exemplo (conhecida por todos).
  const antigo = document.getElementById('avisoSenha'); if (antigo) antigo.remove();
  if (u && u.trocar_senha && location.pathname.indexOf('alterar-senha') < 0) {
    const faixa = document.createElement('div'); faixa.id = 'avisoSenha'; faixa.className = 'faixa-aviso'; faixa.setAttribute('role', 'alert');
    faixa.innerHTML = `Você está usando uma senha de exemplo, que é pública. <a href="${p}alterar-senha.html">Troque agora</a>.`;
    $('#topo').insertAdjacentElement('afterend', faixa);
  }
  // Marca o link da página atual.
  document.querySelectorAll('.topo a.link').forEach((a) => { if (a.pathname === location.pathname) a.setAttribute('aria-current', 'page'); });
  // Liga o botão Sair, se existir.
  const s = $('#sair'); if (s) s.onclick = () => sair();
}
// Desenha o rodapé em todas as páginas.
function renderRodape() {
  // Prefixos dos links e criação do elemento <footer>.
  const b = base(), p = b + 'pages/', el = document.createElement('footer');
  // Aplica o estilo do rodapé.
  el.className = 'rodape';
  // Conteúdo do rodapé.
  el.innerHTML = `<div>${NOME_PRODUTO} · Projeto Integrador</div><nav class="pilulas" aria-label="Rodapé"><a href="${b}index.html">Início</a><a href="${p}recursos.html">Recursos</a><a href="${p}privacidade.html">Privacidade</a></nav>`;
  // Insere o rodapé no fim da página.
  document.body.insertBefore(el, $('#aviso'));
}
// Envolve uma função para mostrar na tela qualquer erro que ela lançar (em vez de falhar em silêncio).
const seguro = (fn) => async (...a) => { try { await fn(...a); } catch (e) { aviso(e.message); } };

/* ---------- Login ---------- */
// TELA DE LOGIN: o usuário escolhe uma aba, 'Uso pessoal' (paciente) ou 'Uso clínico' (clínica).
// TELA DE ESCOLHA DE ACESSO: dois cartões grandes (paciente ou consultório). O endereço traz ?acao=entrar ou ?acao=criar.
function pgAcesso() {
  // Lê a ação pedida (padrão: entrar).
  const criar = new URLSearchParams(location.search).get('acao') === 'criar';
  // Ajusta os textos conforme a ação.
  $('#tituloAcesso').textContent = criar ? 'Criar conta: quem é você?' : 'Entrar: quem é você?';
  $('#subAcesso').textContent = criar ? 'Escolha o tipo de conta que você quer criar.' : 'Escolha o tipo de conta que você já tem.';
  // Aponta cada cartão para a tela certa: criar conta (cadastro) ou entrar (login).
  $('#cartaoPaciente').href = criar ? 'cadastro.html' : 'login.html';
  $('#cartaoClinica').href = criar ? 'cadastro-clinica.html' : 'login.html?tipo=clinica';
  // Texto dos botões dos cartões.
  $('#botPaciente').textContent = criar ? 'Criar conta de paciente' : 'Entrar como paciente';
  $('#botClinica').textContent = criar ? 'Cadastrar meu consultório' : 'Entrar como consultório';
}
// TELA 'ESQUECI MINHA SENHA': pede o link de redefinição por e-mail (a resposta é sempre a mesma, por segurança).
function pgEsqueci() {
  $('#form').onsubmit = seguro(async (ev) => {
    ev.preventDefault(); $('#erro').textContent = ''; $('#ok').textContent = '';
    const email = $('#email').value.trim();
    if (!email) { $('#erro').textContent = 'Informe o e-mail da conta.'; return; }
    try {
      const r = await api.post('/auth/esqueci-senha', { email });
      $('#ok').textContent = r.mensagem || 'Se este e-mail tiver cadastro, enviamos um link para redefinir a senha.';
    } catch (e) { $('#erro').textContent = e.message; }
  });
}
// TELA 'CRIAR NOVA SENHA': abre pelo link do e-mail (?token=...) e grava a senha nova.
function pgRedefinir() {
  // Código do link.
  const token = new URLSearchParams(location.search).get('token') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) { $('#form').innerHTML = '<p class="erro">Link inválido. Peça um novo em <a href="esqueci-senha.html">Esqueci minha senha</a>.</p>'; return; }
  $('#form').onsubmit = seguro(async (ev) => {
    ev.preventDefault(); $('#erro').textContent = '';
    const senha = $('#senha').value;
    if (senha.length < 8) { $('#erro').textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
    if (senha !== $('#senha2').value) { $('#erro').textContent = 'As senhas não são iguais.'; return; }
    try {
      await api.post('/auth/redefinir-senha', { token, senha });
      aviso('Senha alterada! Entre com a senha nova.'); setTimeout(() => (location.href = 'acesso.html?acao=entrar'), 1200);
    } catch (e) { $('#erro').textContent = e.message; }
  });
}
// TELA 'ALTERAR SENHA': quem está logado troca a própria senha.
function pgAlterarSenha() {
  // Precisa estar logado (paciente ou clínica).
  if (!exigirLogin()) return;
  $('#form').onsubmit = seguro(async (ev) => {
    ev.preventDefault(); $('#erro').textContent = '';
    const nova = $('#senha').value;
    if (nova.length < 8) { $('#erro').textContent = 'A nova senha precisa ter pelo menos 8 caracteres.'; return; }
    if (nova !== $('#senha2').value) { $('#erro').textContent = 'As senhas novas não são iguais.'; return; }
    try {
      const r = await api.post('/auth/alterar-senha', { senha_atual: $('#atual').value, nova_senha: nova });
      // O servidor encerra os outros logins e devolve um token novo para este.
      sessionStorage.setItem('af_token', r.token);
      // Já trocou: remove o aviso de 'senha de exemplo'.
      const u = usuarioLogado(); if (u) { u.trocar_senha = false; sessionStorage.setItem('af_user', JSON.stringify(u)); }
      aviso('Senha alterada!'); setTimeout(() => (location.href = u && u.perfil === 'admin_clinica' ? 'painel.html' : 'agendar.html'), 1000);
    } catch (e) { $('#erro').textContent = e.message; }
  });
}
function pgLogin() {
  // Parâmetros da URL (?tipo=clinica abre já na aba da clínica; ?novo=1 vem depois de criar a conta).
  const q = new URLSearchParams(location.search);
  // Aba atual: 'paciente' (padrão) ou 'clinica'.
  let tipo = q.get('tipo') === 'clinica' ? 'clinica' : 'paciente';
  // Textos de cada aba.
  const textos = {
    paciente: { h1: 'Bem-vindo de volta', sub: 'Entre para agendar e acompanhar suas consultas.',
      link: 'Novo por aqui? <a href="cadastro.html">Criar conta</a>', dica: '' },
    clinica: { h1: 'Acesso da clínica', sub: 'Entre para gerenciar agenda, profissionais e lembretes.',
      link: 'Sua clínica ainda não tem conta? <a href="cadastro-clinica.html">Cadastrar clínica</a>', dica: '' },
  };
  // Troca a aba: destaca o botão escolhido e atualiza títulos, link de cadastro e dica.
  function aplicar(t) {
    tipo = t;
    // Marca qual aba está selecionada (leitores de tela e visual).
    document.querySelectorAll('#tabPaciente,#tabClinica').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tipo === t)));
    // Atualiza os textos da tela.
    $('#tituloLogin').textContent = textos[t].h1; $('#subLogin').textContent = textos[t].sub;
    $('#linkCadastro').innerHTML = textos[t].link; $('#dicaLogin').textContent = textos[t].dica;
    // Limpa mensagens antigas e mantém a escolha no endereço (se recarregar a página, continua na mesma aba).
    $('#erro').textContent = '';
    history.replaceState(null, '', t === 'clinica' ? '?tipo=clinica' : location.pathname);
  }
  // Clique nas abas.
  document.querySelectorAll('#tabPaciente,#tabClinica').forEach((b) => { b.onclick = () => aplicar(b.dataset.tipo); });
  // Aviso depois de criar a conta (paciente ou clínica).
  if (q.get('novo')) $('#info').textContent = tipo === 'clinica' ? 'Clínica cadastrada! Entre com o e-mail e a senha do responsável.' : 'Conta criada! Entre com seu e-mail e senha.';
  // Abre já na aba certa.
  aplicar(tipo);
  // Quando o formulário é enviado...
  $('#form').onsubmit = async (ev) => {
    // ...impede o envio normal da página e limpa o erro.
    ev.preventDefault(); $('#erro').textContent = '';
    // Tenta entrar.
    try {
      // Envia e-mail, senha e a aba escolhida ao servidor (ele recusa se a conta for do outro tipo).
      const r = await api.post('/auth/login', { email: $('#email').value.trim(), senha: $('#senha').value, tipo });
      // Guarda token e dados do usuário no navegador.
      sessionStorage.setItem('af_token', r.token); sessionStorage.setItem('af_user', JSON.stringify(r.usuario));
      // Vai para o painel (administrador) ou para agendar (paciente).
      location.href = r.usuario.perfil === 'admin_clinica' ? 'painel.html' : 'agendar.html';
    // Se der erro (senha errada, aba errada...), mostra a mensagem.
    } catch (e) { $('#erro').textContent = e.message; }
  };
}
/* ---------- Cadastro ---------- */
// TELA DE CADASTRO do paciente.
function pgCadastro() {
  // Quando o formulário é enviado...
  $('#form').onsubmit = async (ev) => {
    // ...impede o envio normal e limpa o erro.
    ev.preventDefault(); const erro = $('#erro'); erro.textContent = '';
    // Valida: senha com no mínimo 8 caracteres.
    if ($('#senha').value.length < 8) return (erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.');
    // Valida: as duas senhas iguais.
    if ($('#senha').value !== $('#senha2').value) return (erro.textContent = 'As senhas não conferem.');
    // Valida: aceite da política de privacidade.
    if (!$('#lgpd').checked) return (erro.textContent = 'Aceite a política de privacidade para continuar.');
    // Tenta criar a conta.
    try {
      // Envia os dados ao servidor.
      await api.post('/auth/cadastro', { nome: $('#nome').value.trim(), cpf: $('#cpf').value.trim(), telefone: $('#tel').value.trim(), email: $('#email').value.trim(), senha: $('#senha').value, aceite_lgpd: true });
      // Vai para o login com aviso de conta criada.
      location.href = 'login.html?novo=1';
    // Mostra a mensagem de erro.
    } catch (e) { erro.textContent = e.message; }
  };
}
/* ---------- Cadastro de clínica ---------- */
// TELA DE CADASTRO da clínica (cria a clínica e o administrador que usará o painel).
function pgCadastroClinica() {
  // Quando o formulário é enviado...
  $('#form').onsubmit = async (ev) => {
    // ...impede o envio normal e limpa o erro.
    ev.preventDefault(); const erro = $('#erro'); erro.textContent = '';
    // Valida: senha com no mínimo 8 caracteres.
    if ($('#senha').value.length < 8) return (erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.');
    // Valida: as duas senhas iguais.
    if ($('#senha').value !== $('#senha2').value) return (erro.textContent = 'As senhas não conferem.');
    // Valida: aceite da política de privacidade.
    if (!$('#lgpd').checked) return (erro.textContent = 'Aceite a política de privacidade para continuar.');
    // Tenta criar a clínica.
    try {
      // Envia os dados ao servidor (o CNPJ e os demais campos são validados lá também).
      await api.post('/auth/cadastro-clinica', { clinica: $('#clinica').value.trim(), cnpj: $('#cnpj').value.trim(), telefone: $('#telc').value.trim(), endereco: $('#endereco').value.trim(),
        nome: $('#nome').value.trim(), email: $('#email').value.trim(), senha: $('#senha').value, aceite_lgpd: true });
      // Vai para o login da clínica com aviso de sucesso.
      location.href = 'login.html?tipo=clinica&novo=1';
    // Mostra a mensagem de erro.
    } catch (e) { erro.textContent = e.message; }
  };
}
/* ---------- Agendar ---------- */
// TELA DE AGENDAR (e de REAGENDAR, quando a URL tem ?reagendar=número).
async function pgAgendar() {
  // Só paciente logado.
  if (!exigirLogin('paciente')) return;
  // Lê os parâmetros da URL.
  const q = new URLSearchParams(location.search);
  // Se existir, estamos reagendando uma consulta.
  const reagId = q.get('reagendar');
  // Busca clínicas e especialidades (e, ao reagendar, as consultas do paciente) ao mesmo tempo.
  const [clinicas, esps, minhas] = await Promise.all([api.get('/clinicas'), api.get('/especialidades'), reagId ? api.get('/agendamentos/meus') : Promise.resolve([])]);
  // Consulta que está sendo reagendada (null = agendamento novo).
  let alvo = null;   // consulta que está sendo reagendada
  // Modo reagendar:
  if (reagId) {
    // Procura a consulta entre as do paciente.
    alvo = minhas.find((a) => String(a.id) === reagId && a.status === 'agendado');
    // Não achou: avisa e volta.
    if (!alvo) { aviso('Consulta não encontrada.'); setTimeout(() => (location.href = 'meus-agendamentos.html'), 1200); return; }
    // Ajusta títulos e botão.
    $('#tituloAg').textContent = 'Reagendar consulta';
    // Texto do botão de confirmar.
    $('#confirmar').textContent = 'Confirmar novo horário';
    // Esconde o convênio (não muda no reagendamento).
    $('#convenio').hidden = true; $('label[for=convenio]').hidden = true;
    // Trava especialidade e profissional (continuam os mesmos).
    $('#esp').disabled = true; $('#prof').disabled = true;
  }
  // Clínica inicial: a da consulta (reagendando), a da URL, a última escolhida ou a primeira da lista.
  let clinicaId = alvo ? +alvo.clinica_id : (+q.get('clinica') || +sessionStorage.getItem('af_clinica') || 0);
  if (!alvo && !clinicas.some((c) => c.id === clinicaId)) clinicaId = clinicas.length ? clinicas[0].id : 0;
  // Nenhuma clínica com horários: avisa e para.
  if (!clinicaId) { document.querySelector('main .card').innerHTML = '<p class="msg">Ainda não há clínicas com horários disponíveis. Volte mais tarde.</p>'; return; }
  // Seletor de clínica: só aparece se houver mais de uma e não for reagendamento (a consulta continua na mesma clínica).
  const listaClin = clinicas.some((c) => c.id === clinicaId) ? clinicas : clinicas.concat([{ id: clinicaId, nome: alvo.clinica }]);
  $('#clin').innerHTML = listaClin.map((c) => `<option value="${c.id}" ${c.id === clinicaId ? 'selected' : ''}>${esc(c.nome)}${c.endereco ? ' · ' + esc(c.endereco) : ''}</option>`).join('');
  $('#boxClinica').hidden = listaClin.length < 2 || !!alvo;
  // Pedaço de endereço que diz ao servidor de qual clínica são os dados.
  const cq = () => `clinica_id=${clinicaId}`;
  // Tipo de consulta inicial (o da consulta ou o da URL); o primeiro da clínica se não houver.
  let tipoIni = alvo ? +alvo.tipo_consulta_id : (+q.get('tipo') || 0);
  // Profissional inicial (o da consulta ou o da URL).
  let profIni = alvo ? alvo.profissional_id : (+q.get('prof') || null);
  // Busca os tipos de consulta da clínica escolhida e desenha os botões de escolha.
  async function carregarTipos() {
    const tipos = await api.get(`/tipos-consulta?${cq()}`);
    const marcado = tipos.some((t) => t.id === tipoIni) ? tipoIni : (tipos.length ? tipos[0].id : 0);
    tipoIni = 0;
    $('#tipos').innerHTML = tipos.length ? tipos.map((t) => `<label class="opcao"><input type="radio" name="tipo" value="${t.id}" ${t.id === marcado ? 'checked' : ''} ${alvo ? 'disabled' : ''}>${esc(t.nome)}<small>${t.duracao_min} min</small></label>`).join('') : '<p class="msg">Esta clínica ainda não tem tipos de consulta.</p>';
  }
  // Preenche o seletor de especialidades.
  $('#esp').innerHTML = '<option value="">Todas</option>' + esps.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('');
  // Data vinda da URL (ex.: do botão 'Agendar agora' da lista de espera).
  const dataQ = q.get('data');
  // Não permite datas passadas e já preenche a data.
  $('#data').min = hoje(); $('#data').value = dataQ && dataQ >= hoje() ? dataQ : hoje();
  // Horário escolhido pelo paciente.
  let hora = null;
  // Devolve o tipo de consulta marcado.
  const tipo = () => { const r = $('input[name=tipo]:checked'); return r ? r.value : ''; };
  // Busca e mostra os horários livres.
  // Número da última busca de horários (para ignorar respostas antigas que chegam atrasadas).
  let buscaAtual = 0;
  async function carregarHorarios() {
    // Limpa a escolha anterior e desabilita o botão.
    hora = null; $('#confirmar').disabled = true; $('#espera').innerHTML = '';
    // Elementos e valores escolhidos.
    const box = $('#horarios'), prof = $('#prof').value, data = $('#data').value;
    // Falta escolher profissional ou data.
    if (!prof || !data) { box.innerHTML = '<p class="msg">Escolha o profissional e a data.</p>'; return; }
    // Marca esta busca como a mais recente (respostas de buscas antigas são ignoradas).
    const minha = ++buscaAtual;
    // Mostra 'Buscando horários…'.
    box.innerHTML = '<p class="msg">Buscando horários…</p>';
    // Pede ao servidor os horários livres. Se falhar, mostra o motivo no lugar de 'Buscando horários…' (antes a tela ficava presa).
    let hs;
    try { hs = await api.get(`/horarios?${cq()}&profissional_id=${prof}&tipo_consulta_id=${tipo()}&data=${data}`); }
    catch (e) { if (minha === buscaAtual) box.innerHTML = `<p class="msg" role="alert">Não foi possível carregar os horários: ${esc(e.message)}</p>`; return; }
    // Chegou uma busca mais nova enquanto esta rodava: descarta esta resposta.
    if (minha !== buscaAtual) return;
    // Desenha um botão por horário (ou avisa que não há; se for hoje, explica que o dia já está no fim).
    box.innerHTML = hs.length ? hs.map((h) => `<button type="button" class="horario" aria-pressed="false">${esc(h)}</button>`).join('')
      : `<p class="msg">${data === hoje() ? 'Não há mais horários livres hoje. Escolha outra data ou outro profissional.' : 'Sem horários livres nesta data. Tente outro dia ou outro profissional.'}</p>`;
    // Sem horários: oferece entrar na lista de espera.
    if (!hs.length && !alvo) $('#espera').innerHTML = '<p class="msg">Quer ser avisado se um horário vagar neste dia?</p><button class="btn sec" id="bEspera" type="button">Avisar-me se vagar</button>';
  }
  // Busca e mostra os profissionais do tipo e da especialidade escolhidos.
  async function carregarProfs() {
    // Pede ao servidor a lista.
    const ps = tipo() ? await api.get(`/profissionais?${cq()}&tipo_consulta_id=${tipo()}&especialidade_id=${$('#esp').value}`) : [];
    // Preenche o seletor (ou avisa que não há profissional).
    $('#prof').innerHTML = ps.length ? ps.map((p) => `<option value="${p.id}">${esc(p.nome)} · ${esc(p.especialidade)}</option>`).join('') : '<option value="">Nenhum profissional disponível</option>';
    // Seleciona o profissional inicial, uma única vez.
    if (profIni) { $('#prof').value = String(profIni); profIni = null; }
    // Em seguida, carrega os horários.
    await carregarHorarios();
  }
  // Mudou tipo ou especialidade: recarrega profissionais.
  // (os botões de tipo são redesenhados quando a clínica muda, por isso o evento fica na caixa que os contém)
  $('#tipos').onchange = $('#esp').onchange = seguro(carregarProfs);
  // Mudou a clínica: guarda a escolha, recarrega os tipos e, em seguida, os profissionais.
  $('#clin').onchange = seguro(async () => { clinicaId = +$('#clin').value; try { sessionStorage.setItem('af_clinica', clinicaId); } catch (e) {} await carregarTipos(); await carregarProfs(); });
  // Mudou profissional ou data: recarrega horários.
  $('#prof').onchange = $('#data').onchange = seguro(carregarHorarios);
  // Clique em um horário:
  $('#horarios').onclick = (ev) => {
    // Acha o botão clicado.
    const b = ev.target.closest('.horario'); if (!b) return;
    // Desmarca os outros.
    document.querySelectorAll('.horario').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    // Marca este, guarda a hora e habilita o botão de confirmar.
    b.setAttribute('aria-pressed', 'true'); hora = b.textContent; $('#confirmar').disabled = false;
  };
  // Clique em 'Avisar-me se vagar':
  $('#espera').onclick = seguro(async (ev) => {
    // Só reage a esse botão.
    if (!ev.target.closest('#bEspera')) return;
    // Pede ao servidor para entrar na lista de espera.
    await api.post('/lista-espera', { clinica_id: clinicaId, profissional_id: +$('#prof').value, tipo_consulta_id: +tipo(), data: $('#data').value });
    // Confirma ao paciente.
    $('#espera').innerHTML = '<p><strong>Pronto! Se um horário vagar, avisamos você em "Meus agendamentos".</strong></p>';
  });
  // Clique em Confirmar:
  $('#confirmar').onclick = seguro(async () => {
    // Monta o horário no formato AAAA-MM-DDTHH:MM.
    const inicio = `${$('#data').value}T${hora}`;
    // Tenta salvar.
    try {
      // Reagendando: troca o horário da consulta.
      if (alvo) await api.patch(`/agendamentos/${alvo.id}/reagendar`, { inicio });
      // Agendamento novo: cria a consulta.
      else await api.post('/agendamentos', { clinica_id: clinicaId, profissional_id: +$('#prof').value, tipo_consulta_id: +tipo(), inicio, convenio: $('#convenio').value.trim() || 'Particular' });
      // Avisa e vai para 'Meus agendamentos'.
      aviso(alvo ? 'Consulta reagendada!' : 'Consulta agendada!'); setTimeout(() => (location.href = 'meus-agendamentos.html'), 800);
    // Se o horário foi ocupado ou deu erro, avisa e atualiza os horários.
    } catch (e) { aviso(e.message); await carregarHorarios(); }
  });
  // Carrega os tipos e os profissionais ao abrir a tela.
  await carregarTipos();
  await carregarProfs();
}
/* ---------- Meus agendamentos ---------- */
// TELA 'MEUS AGENDAMENTOS'.
async function pgMeus() {
  // Só paciente logado.
  if (!exigirLogin('paciente')) return;
  // Busca e desenha as consultas e a lista de espera.
  async function listar() {
    // Busca as duas listas ao mesmo tempo.
    const [as, es] = await Promise.all([api.get('/agendamentos/meus'), api.get('/lista-espera')]);
    // Desenha um cartão por consulta (com Reagendar e Cancelar quando agendada).
    $('#lista').innerHTML = as.length ? as.map((a) => `<article class="card"><p>${badge(a.status)} ${a.confirmado && a.status === 'agendado' ? '<span class="badge ok">Confirmada</span>' : ''}</p><h3>${esc(fmtData(a.inicio))}</h3><p>${esc(a.tipo)} · ${esc(a.profissional)}<br><span class="msg">${esc(a.convenio)}</span></p>${a.status === 'agendado' ? `<a class="btn sec peq" href="agendar.html?reagendar=${a.id}">Reagendar</a> <button class="btn perigo peq" data-id="${a.id}">Cancelar consulta</button>` : ''}</article>`).join('')
      : '<p class="msg">Você ainda não tem consultas. <a href="agendar.html">Agendar agora</a></p>';
    // Desenha a lista de espera (com 'Agendar agora' quando a vaga foi liberada).
    $('#espera').innerHTML = es.length ? '<h2>Lista de espera</h2><div class="grade3">' + es.map((e) => `<article class="card ${e.status === 'vaga' ? 'fundo' : ''}"><p>${e.status === 'vaga' ? '<span class="badge ok">Vaga liberada!</span>' : '<span class="badge">Aguardando vaga</span>'}</p><h3>${esc(fmtDia(e.data))}</h3><p>${esc(e.tipo)} · ${esc(e.profissional)}</p>${e.status === 'vaga' ? `<a class="btn peq" href="agendar.html?clinica=${e.clinica_id || ''}&prof=${e.profissional_id}&tipo=${e.tipo_consulta_id}&data=${esc(e.data)}">Agendar agora</a> ` : ''}<button class="btn perigo peq" data-sair="${e.id}">Sair da lista</button></article>`).join('') + '</div>' : '';
  }
  // Clique em Cancelar consulta:
  $('#lista').onclick = seguro(async (ev) => {
    // Acha o botão e pede confirmação.
    const b = ev.target.closest('[data-id]'); if (!b || !confirm('Cancelar esta consulta?')) return;
    // Cancela no servidor e atualiza a tela.
    await api.patch(`/agendamentos/${b.dataset.id}/cancelar`); aviso('Consulta cancelada.'); await listar();
  });
  // Clique em Sair da lista:
  $('#espera').onclick = seguro(async (ev) => {
    // Acha o botão.
    const b = ev.target.closest('[data-sair]'); if (!b) return;
    // Remove o pedido e atualiza.
    await api.del(`/lista-espera/${b.dataset.sair}`); aviso('Você saiu da lista de espera.'); await listar();
  });
  // Desenha as listas ao abrir a tela.
  await listar();
}
/* ---------- Painel da clínica ---------- */
// PAINEL DA CLÍNICA (abas).
async function pgPainel() {
  // Só administrador logado.
  if (!exigirLogin('admin_clinica')) return;
  // Cada aba tem uma função que busca os dados e desenha a tabela.
  const abas = {
    // Aba AGENDA DO DIA.
    agenda: async () => {
      // Busca as consultas do dia.
      const as = await api.get(`/clinica/agenda?data=${$('#dataAgenda').value}`);
      // Agrupa por profissional.
      const por = {}; as.forEach((a) => (por[a.profissional] = por[a.profissional] || []).push(a));
      // Nomes dos profissionais que têm consultas.
      const nomes = Object.keys(por);
      // Escolhe os botões de cada consulta.
      const acoes = (a) => {
        // Cancelada: sem botões.
        if (a.status === 'cancelado') return '';
        // Já começou: botões Compareceu e Faltou.
        if (a.pode_registrar_presenca) return `<button class="btn sec peq" data-pres="${a.id}" data-st="concluido">Compareceu</button> <button class="btn perigo peq" data-pres="${a.id}" data-st="faltou">Faltou</button>`;
        // Ainda vai acontecer: botões Reagendar e Cancelar.
        if (a.status === 'agendado') return `<button class="btn sec peq" data-reag="${a.id}" data-prof="${a.profissional_id}" data-tipo="${a.tipo_consulta_id}">Reagendar</button> <button class="btn perigo peq" data-cancelar="${a.id}">Cancelar</button>`;
        // Nenhum botão.
        return '';
      };
      // Desenha uma coluna por profissional, com um bloco por consulta.
      $('#agendaBox').innerHTML = nomes.length ? '<div class="colunas">' + nomes.map((n) => `<section><h3>${esc(n)}</h3>${por[n].map((a) => `<div class="bloco ${a.status === 'cancelado' ? 'cancelado' : a.status === 'faltou' ? 'faltou' : ''}"><strong>${esc(a.inicio.slice(11, 16))}–${esc(a.fim.slice(11, 16))}</strong> ${esc(a.paciente)}<br>${esc(a.tipo)} ${badge(a.status)} ${a.confirmado && a.status === 'agendado' ? '<span class="badge ok">Confirmada</span>' : ''}<div style="margin-top:.4rem">${acoes(a)}</div><div data-reag-box="${a.id}" hidden></div></div>`).join('')}</section>`).join('') + '</div>'
        : '<p class="msg">Nenhuma consulta neste dia.</p>';
    },
    // Aba PROFISSIONAIS.
    profissionais: async () => {
      // Busca profissionais, especialidades e tipos.
      const [ps, esps, tipos] = await Promise.all([api.get('/clinica/profissionais'), api.get('/especialidades'), api.get('/clinica/tipos-consulta')]);
      // Desenha a tabela.
      $('#tbProf').innerHTML = ps.map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.especialidade)}</td><td>${esc(p.registro_profissional)}</td><td><span class="badge ${p.ativo ? 'ok' : 'inativo'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td><td><button class="btn sec peq" data-ativo="${p.id}" data-v="${p.ativo ? 0 : 1}">${p.ativo ? 'Desativar' : 'Ativar'}</button></td></tr>`).join('');
      // Preenche o seletor de especialidades do formulário.
      $('#pEsp').innerHTML = esps.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('');
      // Cria as caixas de marcar dos tipos de consulta.
      $('#pTipos').innerHTML = tipos.map((t) => `<label class="check"><input type="checkbox" value="${t.id}" checked>${esc(t.nome)}</label>`).join('');
    },
    // Aba TIPOS DE CONSULTA.
    tipos: async () => {
      // Busca os tipos.
      const ts = await api.get('/clinica/tipos-consulta');
      // Desenha a tabela.
      $('#tbTipos').innerHTML = ts.map((t) => `<tr><td>${esc(t.nome)}</td><td>${t.duracao_min} min</td><td>${t.eh_retorno ? 'Sim' : 'Não'}</td></tr>`).join('');
    },
    // Aba EXPEDIENTES (horários de trabalho).
    expedientes: async () => {
      // Na primeira vez, preenche o seletor de profissionais.
      if (!$('#eProf').options.length) { const ps = await api.get('/clinica/profissionais'); $('#eProf').innerHTML = ps.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join(''); }
      // Busca os expedientes do profissional escolhido.
      const es = await api.get(`/clinica/expedientes?profissional_id=${$('#eProf').value}`);
      // Desenha a tabela.
      $('#tbExp').innerHTML = es.length ? es.map((e) => `<tr><td>${DIAS[e.dia_semana]}</td><td>${esc(e.hora_inicio.slice(0, 5))}–${esc(e.hora_fim.slice(0, 5))}</td><td><button class="btn perigo peq" data-rem="${e.id}">Remover</button></td></tr>`).join('') : '<tr><td colspan="3" class="msg">Nenhum horário cadastrado. Este profissional não aparece para os pacientes.</td></tr>';
    },
    // Aba LEMBRETES.
    lembretes: async () => {
      // Busca as consultas agendadas da data escolhida.
      const as = (await api.get(`/clinica/agenda?data=${$('#dataLemb').value}`)).filter((a) => a.status === 'agendado');
      // Desenha a tabela com a situação de cada lembrete.
      $('#tbLemb').innerHTML = as.length ? as.map((a) => `<tr><td>${esc(a.paciente)}<br><span class="msg">${esc(a.telefone)}</span></td><td>${esc(a.inicio.slice(11, 16))}</td><td>${esc(a.profissional)}</td><td>${a.confirmado ? '<span class="badge ok">Confirmada</span>' : a.lembrete_enviado ? '<span class="badge">Lembrete enviado</span>' : '<span class="badge inativo">Pendente</span>'}</td><td><button class="btn sec peq" data-lemb="${a.id}">${a.lembrete_enviado ? 'Reenviar' : 'Enviar lembrete'}</button></td></tr>`).join('')
        : '<tr><td colspan="5" class="msg">Nenhuma consulta agendada nesta data.</td></tr>';
    },
    // Aba BLOQUEIOS (férias, feriados, ausências).
    bloqueios: async () => {
      // Na primeira vez, preenche o seletor de profissionais.
      if ($('#bProf').options.length < 2) {
        // Busca os profissionais.
        const ps = await api.get('/clinica/profissionais');
        // Opção 'Toda a clínica' mais os profissionais.
        $('#bProf').innerHTML = '<option value="">Toda a clínica</option>' + ps.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
      }
      // Busca os bloqueios.
      const bs = await api.get('/clinica/bloqueios');
      // Desenha a tabela.
      $('#tbBloq').innerHTML = bs.length ? bs.map((b) => `<tr><td>${esc(b.profissional)}</td><td>${esc(fmtPeriodo(b))}</td><td>${esc(b.motivo)}</td><td><button class="btn perigo peq" data-rembloq="${b.id}">Remover</button></td></tr>`).join('')
        : '<tr><td colspan="4" class="msg">Nenhum bloqueio cadastrado.</td></tr>';
    },
    // Aba LISTA DE ESPERA.
    espera: async () => {
      // Busca quem está esperando.
      const es = await api.get('/clinica/lista-espera');
      // Desenha a tabela.
      $('#tbEspera').innerHTML = es.length ? es.map((e) => `<tr><td>${esc(e.paciente)}<br><span class="msg">${esc(e.telefone)}</span></td><td>${esc(fmtDia(e.data))}</td><td>${esc(e.profissional)}</td><td>${esc(e.tipo)}</td><td>${e.status === 'vaga' ? '<span class="badge ok">Vaga liberada</span>' : '<span class="badge">Aguardando</span>'}</td></tr>`).join('')
        : '<tr><td colspan="5" class="msg">Ninguém na lista de espera.</td></tr>';
    },
    // Aba RELATÓRIOS.
    relatorios: async () => {
      // Busca os números do período escolhido.
      const r = await api.get(`/clinica/relatorio?de=${$('#rDe').value}&ate=${$('#rAte').value}`);
      // Formata a porcentagem (ou '—' quando não há dados).
      const pct = (x) => (x === null ? '—' : x.toFixed(1).replace('.', ',') + '%');
      // Totais gerais.
      const t = r.totais;
      // Monta o cabeçalho das tabelas.
      const cab = (p) => `<thead><tr><th>${p}</th><th>Total</th><th>Atendidas</th><th>Faltas</th><th>Canceladas</th><th>Futuras</th><th>Taxa de faltas</th></tr></thead>`;
      // Monta uma linha de tabela.
      const tr = (nome, l) => `<tr><td>${esc(nome)}</td><td>${l.total}</td><td>${l.atendidas}</td><td>${l.faltas}</td><td>${l.canceladas}</td><td>${l.futuras}</td><td>${pct(l.taxa_faltas)}</td></tr>`;
      // Linha mostrada quando não há consultas.
      const vazio = '<tr><td colspan="7" class="msg">Sem consultas no período.</td></tr>';
      // Desenha os cartões de totais e as duas tabelas (por profissional e por dia).
      $('#relBox').innerHTML = '<div class="grade3">' + [['Consultas', t.total], ['Atendidas', t.atendidas], ['Faltas', t.faltas], ['Canceladas', t.canceladas], ['Taxa de faltas', pct(t.taxa_faltas)]].map(([n, v]) => `<div class="card fundo"><h2 style="margin:0">${v}</h2><p style="margin:0">${n}</p></div>`).join('') + '</div>'
        + `<h3>Por profissional</h3><div class="card tabela"><table>${cab('Profissional')}<tbody>${r.por_profissional.map((l) => tr(l.profissional, l)).join('') || vazio}</tbody></table></div>`
        + `<h3>Por dia</h3><div class="card tabela"><table>${cab('Dia')}<tbody>${r.por_dia.map((l) => tr(fmtDia(l.dia), l)).join('') || vazio}</tbody></table></div>`
        + '<p class="msg">Taxa de faltas = faltas ÷ (atendidas + faltas). Consultas passadas sem registro contam como atendidas, por isso marque as faltas na Agenda do dia.</p>';
    },
  };
  // Troca de aba.
  function abrir(nome) {
    // Marca a aba escolhida.
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.aba === nome));
    // Mostra só a seção da aba escolhida.
    document.querySelectorAll('[data-painel]').forEach((s) => (s.hidden = s.dataset.painel !== nome));
    // Carrega os dados da aba.
    seguro(abas[nome])();
  }
  // Clique em uma aba chama abrir().
  document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => abrir(b.dataset.aba)));
  // Valores iniciais: data da agenda é hoje; a dos lembretes é amanhã.
  $('#dataAgenda').value = hoje(); $('#dataAgenda').onchange = seguro(abas.agenda); $('#dataLemb').value = amanha(); $('#dataLemb').onchange = seguro(abas.lembretes); $('#eProf').onchange = seguro(abas.expedientes);
  // Relatório: do dia 1º do mês até hoje; bloqueios: não aceita datas passadas.
  $('#rDe').value = hoje().slice(0, 8) + '01'; $('#rAte').value = hoje(); $('#bIni').min = $('#bFim').min = hoje();
  // Preenche o seletor de dias da semana.
  $('#DIAopts').innerHTML = DIAS.map((d, i) => `<option value="${i}">${d}</option>`).join('');
  // Um único ouvinte de cliques para todos os botões do painel (cada botão traz um data-... que diz o que fazer).
  document.body.onclick = seguro(async (ev) => {
    // Elemento clicado.
    const t = ev.target;
    // Cancelar consulta (a clínica cancela).
    if (t.dataset.cancelar && confirm('Cancelar esta consulta?')) { await api.patch(`/agendamentos/${t.dataset.cancelar}/cancelar`); await abas.agenda(); }
    // Ativar ou desativar profissional.
    if (t.dataset.ativo) { await api.patch(`/clinica/profissionais/${t.dataset.ativo}`, { ativo: +t.dataset.v }); await abas.profissionais(); }
    // Remover expediente.
    if (t.dataset.rem && confirm('Remover este horário?')) { await api.del(`/clinica/expedientes/${t.dataset.rem}`); await abas.expedientes(); }
    // Enviar lembrete de uma consulta.
    if (t.dataset.lemb) {
      // Pede ao servidor para enviar (ou gerar o link do WhatsApp).
      const r = await api.post(`/clinica/agendamentos/${t.dataset.lemb}/lembrete`, {});
      // Modo link: troca o botão por 'Abrir WhatsApp' com a mensagem pronta.
      if (r.modo === 'link') t.parentElement.innerHTML = `<a class="btn peq" href="${esc(r.link)}" target="_blank" rel="noopener">Abrir WhatsApp</a>`;
      // Outros modos: o servidor já enviou.
      else { aviso('Lembrete enviado.'); await abas.lembretes(); }
    }
    // Enviar todos os lembretes pendentes do dia.
    if (t.dataset.todos !== undefined) {
      // Pede ao servidor para enviar a todos.
      const r = await api.post('/clinica/lembretes/enviar', { data: $('#dataLemb').value });
      // Mostra quantos foram enviados e quantos falharam.
      aviso(`Enviados: ${r.enviados}. Falhas: ${r.falhas}.`); await abas.lembretes();
    }
    // Registrar presença (Compareceu ou Faltou).
    if (t.dataset.pres) { await api.patch(`/clinica/agendamentos/${t.dataset.pres}/status`, { status: t.dataset.st }); aviso('Presença registrada.'); await abas.agenda(); }
    // Reagendar: abre ou fecha a caixa de escolha de nova data.
    if (t.dataset.reag) {
      // Acha a caixa dessa consulta.
      const box = document.querySelector(`[data-reag-box="${t.dataset.reag}"]`);
      // Alterna entre mostrar e esconder.
      box.hidden = !box.hidden;
      // Ao abrir...
      if (!box.hidden) {
        // Guarda profissional e tipo na caixa.
        box.dataset.prof = t.dataset.prof; box.dataset.tipo = t.dataset.tipo;
        // Cria o campo de data e o espaço dos horários.
        box.innerHTML = `<label for="rd${t.dataset.reag}">Nova data</label><input id="rd${t.dataset.reag}" type="date" min="${hoje()}" value="${$('#dataAgenda').value}" data-reag-data="1"><div class="horarios" style="margin-top:.5rem"></div>`;
        // Busca os horários da data escolhida.
        await slotsReag(box);
      }
    }
    // Clique em um novo horário: reagenda a consulta.
    if (t.dataset.novo) { await api.patch(`/agendamentos/${t.dataset.id}/reagendar`, { inicio: t.dataset.novo }); aviso('Consulta reagendada.'); await abas.agenda(); }
    // Remover bloqueio.
    if (t.dataset.rembloq && confirm('Remover este bloqueio?')) { await api.del(`/clinica/bloqueios/${t.dataset.rembloq}`); await abas.bloqueios(); }
    // Gerar relatório.
    if (t.dataset.gerar !== undefined) await abas.relatorios();
  });
  // Formulário NOVO PROFISSIONAL:
  $('#fProf').onsubmit = seguro(async (ev) => {
    // Impede o envio normal da página.
    ev.preventDefault();
    // Envia ao servidor.
    await api.post('/clinica/profissionais', { nome: $('#pNome').value.trim(), especialidade_id: +$('#pEsp').value, registro_profissional: $('#pReg').value.trim(), tipo_ids: [...document.querySelectorAll('#pTipos input:checked')].map((i) => +i.value) });
    // Limpa o formulário, avisa e atualiza a tabela.
    ev.target.reset(); aviso('Profissional salvo.'); await abas.profissionais();
  });
  // Formulário NOVO TIPO DE CONSULTA:
  $('#fTipo').onsubmit = seguro(async (ev) => {
    // Impede o envio normal da página.
    ev.preventDefault();
    // Envia ao servidor.
    await api.post('/clinica/tipos-consulta', { nome: $('#tNome').value.trim(), duracao_min: +$('#tDur').value, eh_retorno: $('#tRet').checked ? 1 : 0 });
    // Limpa o formulário, avisa e atualiza a tabela.
    ev.target.reset(); aviso('Tipo de consulta salvo.'); await abas.tipos();
  });
  // Formulário NOVO EXPEDIENTE:
  $('#fExp').onsubmit = seguro(async (ev) => {
    // Impede o envio normal da página.
    ev.preventDefault();
    // O fim precisa ser depois do início.
    if ($('#eFim').value <= $('#eIni').value) return aviso('O horário final precisa ser depois do inicial.');
    // Envia ao servidor.
    await api.post('/clinica/expedientes', { profissional_id: +$('#eProf').value, dia_semana: +$('#DIAopts').value, hora_inicio: $('#eIni').value, hora_fim: $('#eFim').value });
    // Avisa e atualiza a tabela.
    aviso('Horário adicionado.'); await abas.expedientes();
  });
  // Busca e mostra os horários para reagendar uma consulta (na agenda do dia).
  async function slotsReag(box) {
    // Lê a data escolhida e localiza os elementos da caixa.
    const data = box.querySelector('input').value, alvo = box.querySelector('.horarios'), id = box.dataset.reagBox;
    // Sem data: limpa.
    if (!data) { alvo.innerHTML = ''; return; }
    // Mostra 'Buscando horários…'.
    alvo.innerHTML = '<p class="msg">Buscando horários…</p>';
    // Pede ao servidor os horários livres.
    const hs = await api.get(`/horarios?profissional_id=${box.dataset.prof}&tipo_consulta_id=${box.dataset.tipo}&data=${data}`);
    // Desenha um botão por horário.
    alvo.innerHTML = hs.length ? hs.map((h) => `<button type="button" class="horario" data-id="${id}" data-novo="${data}T${esc(h)}">${esc(h)}</button>`).join('') : '<p class="msg">Sem horários livres nesta data.</p>';
  }
  // Quando a data da caixa de reagendamento muda, busca os horários de novo.
  document.body.onchange = seguro(async (ev) => { if (ev.target.dataset.reagData !== undefined) await slotsReag(ev.target.closest('[data-reag-box]')); });
  // Formulário NOVO BLOQUEIO:
  $('#fBloq').onsubmit = seguro(async (ev) => {
    // Impede o envio normal da página.
    ev.preventDefault();
    // Envia ao servidor (sem data final, vale só a data inicial).
    const r = await api.post('/clinica/bloqueios', { profissional_id: $('#bProf').value ? +$('#bProf').value : null, data_inicio: $('#bIni').value, hora_inicio: $('#bHIni').value, data_fim: $('#bFim').value || $('#bIni').value, hora_fim: $('#bHFim').value, motivo: $('#bMotivo').value.trim() });
    // Limpa o formulário.
    ev.target.reset();
    // Se já havia consultas marcadas no período, avisa quantas.
    $('#bAviso').textContent = r.conflitos ? `Bloqueio salvo. Atenção: ${r.conflitos} consulta(s) já marcada(s) nesse período. Reagende ou cancele pela Agenda do dia.` : '';
    // Avisa e atualiza a tabela.
    aviso('Bloqueio salvo.'); await abas.bloqueios();
  });
  // Abre a primeira aba ao carregar o painel.
  abrir('agenda');
}

/* ---------- Confirmar ou cancelar pelo link do lembrete (página pública) ---------- */
// PÁGINA PÚBLICA do link do lembrete (sem login): o paciente confirma ou cancela.
async function pgConfirmar() {
  // Lê o código do link (?t=...).
  const token = new URLSearchParams(location.search).get('t') || '';
  // Áreas da tela.
  const dados = $('#dados'), acoes = $('#acoes');
  // Busca e mostra a consulta (com uma mensagem opcional).
  async function mostrar(msg) {
    // Limpa os botões.
    acoes.innerHTML = '';
    // Vai guardar a consulta.
    let a;
    // Pede ao servidor os dados da consulta pelo código.
    try { a = await api.get(`/lembretes/${encodeURIComponent(token)}`); }
    // Código inválido ou vencido: mostra o erro.
    catch (e) { dados.innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
    // Mostra primeiro nome, data, tipo, profissional e situação.
    dados.innerHTML = `<p>Olá, ${esc(a.paciente)}!</p><h2>${esc(fmtData(a.inicio))}</h2><p>${esc(a.tipo)} · ${esc(a.profissional)}</p><p>${badge(a.status)} ${a.confirmado && a.status === 'agendado' ? '<span class="badge ok">Confirmada</span>' : ''}</p>${msg ? `<p><strong>${esc(msg)}</strong></p>` : ''}`;
    // Se não está mais agendada, não mostra botões.
    if (a.status !== 'agendado') return;
    // A consulta ainda vai acontecer?
    const futura = new Date(a.inicio) > new Date();
    // Se já passou, sem botões.
    if (!futura) return;
    // Botão Confirmar (só se ainda não confirmou).
    if (!a.confirmado) acoes.innerHTML += '<button class="btn pilula" id="bConf">Confirmar presença</button>';
    // Botão Cancelar.
    acoes.innerHTML += '<button class="btn perigo pilula" id="bCanc">Cancelar consulta</button>';
    // Confirmar: envia ao servidor e mostra mensagem.
    const bc = $('#bConf'); if (bc) bc.onclick = seguro(async () => { await api.post(`/lembretes/${token}/confirmar`, {}); await mostrar('Presença confirmada. Até lá!'); });
    // Cancelar: pede confirmação, cancela e mostra mensagem.
    $('#bCanc').onclick = seguro(async () => { if (!confirm('Cancelar esta consulta?')) return; await api.post(`/lembretes/${token}/cancelar`, {}); await mostrar('Consulta cancelada. O horário foi liberado.'); });
  }
  // Mostra a consulta ao abrir a página.
  await mostrar('');
}

// ATALHOS DE ROLAGEM (páginas Início e Recursos): ao clicar, o bloco de destino pisca, para o clique sempre ter efeito visível
// (principalmente quando a página não tem mais para onde rolar, como no atalho 'Segurança').
function ativarAtalhos() {
  document.querySelectorAll('.pilulas.sep a[href^="#"]').forEach((a) => {
    a.addEventListener('click', () => {
      // Bloco de destino (a seção com o id do link).
      const alvo = document.getElementById(a.getAttribute('href').slice(1)); if (!alvo) return;
      // Reinicia a animação (tira e põe a classe) e remove depois de 1,6 s.
      alvo.classList.remove('destaque'); void alvo.offsetWidth; alvo.classList.add('destaque');
      setTimeout(() => alvo.classList.remove('destaque'), 1600);
    });
  });
}

// BOTÃO "MOSTRAR SENHA" (olhinho): coloca, em todo campo de senha, um botão com ícone de olho que alterna entre esconder (●●●) e mostrar o texto.
// Desenhos (SVG) dos dois estados: olho aberto = "clique para mostrar"; olho riscado = "clique para ocultar".
const OLHO_ABERTO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const OLHO_RISCADO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function ativarMostrarSenha() {
  document.querySelectorAll('input[type="password"]').forEach((campo) => {
    // Cria uma 'caixa' ao redor do campo, para posicionar o botão dentro dele (à direita).
    const caixa = document.createElement('span'); caixa.className = 'campo-senha';
    campo.parentNode.insertBefore(caixa, campo); caixa.appendChild(campo);
    // Cria o botão (type=button para não enviar o formulário ao clicar).
    const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'ver-senha';
    bt.innerHTML = OLHO_ABERTO; bt.title = 'Mostrar senha'; bt.setAttribute('aria-label', 'Mostrar senha'); bt.setAttribute('aria-pressed', 'false');
    // Função que deixa o botão no estado "senha escondida" ou "senha visível".
    const marcar = (visivel) => {
      campo.type = visivel ? 'text' : 'password';
      bt.innerHTML = visivel ? OLHO_RISCADO : OLHO_ABERTO;
      bt.title = visivel ? 'Ocultar senha' : 'Mostrar senha';
      bt.setAttribute('aria-label', bt.title);
      bt.setAttribute('aria-pressed', String(visivel));
    };
    // Ao clicar: alterna o estado e mantém o cursor no campo, para continuar digitando.
    bt.onclick = () => { marcar(campo.type === 'password'); campo.focus(); };
    caixa.appendChild(bt);
    // Segurança: se o formulário for enviado com a senha visível, volta a escondê-la.
    if (campo.form) campo.form.addEventListener('submit', () => marcar(false));
  });
}

// Quando a página termina de carregar...
document.addEventListener('DOMContentLoaded', () => {
  // Quem já está logado não precisa ver login/cadastro: vai direto para a própria tela.
  const logado = usuarioLogado();
  if (logado && sessionStorage.getItem('af_token') && ['acesso', 'login', 'cadastro', 'cadastro-clinica'].includes(document.body.dataset.page)) {
    location.replace(logado.perfil === 'admin_clinica' ? base() + 'pages/painel.html' : base() + 'pages/agendar.html'); return;
  }
  // ...liga os atalhos de rolagem (se a página tiver)...
  ativarAtalhos();
  // ...as máscaras de CPF, CNPJ e telefone...
  ativarMascaras();
  // ...e o botão 'Mostrar senha' nos campos de senha.
  ativarMostrarSenha();
  // ...desenha a barra do topo e o rodapé...
  renderTopo(); renderRodape();
  // ...escolhe a função da tela pelo data-page do <body>...
  const pg = { esqueci: pgEsqueci, redefinir: pgRedefinir, 'alterar-senha': pgAlterarSenha, acesso: pgAcesso, login: pgLogin, cadastro: pgCadastro, 'cadastro-clinica': pgCadastroClinica, agendar: pgAgendar, meus: pgMeus, painel: pgPainel, confirmar: pgConfirmar }[document.body.dataset.page];
  // ...e executa (mostrando qualquer erro na tela).
  if (pg) seguro(pg)();
});
